import type { ToolContext, ToolDescriptor } from "./types";
import { PermissionManager } from "./permissions";
import { ToolRegistry } from "./toolRegistry";

/**
 * UnoOneHealthRuntime — the generic dispatcher. It owns:
 *  - the tool registry (registered by each health-skill)
 *  - the permission manager (consent + device gates)
 *
 * It deliberately contains NO health logic. Validating input/output against
 * each tool's Zod schema and enforcing permissions is enough here; the safety
 * wording guards live inside the skills.
 */
export class UnoOneHealthRuntime {
  constructor(
    private readonly registry: ToolRegistry,
    private readonly permissions: PermissionManager,
  ) {}

  static create(): UnoOneHealthRuntime {
    return new UnoOneHealthRuntime(new ToolRegistry(), new PermissionManager());
  }

  get tools(): ToolRegistry {
    return this.registry;
  }

  get consent(): PermissionManager {
    return this.permissions;
  }

  register(tool: ToolDescriptor): this {
    this.registry.register(tool);
    return this;
  }

  async invoke<TOutput = unknown>(
    name: string,
    input: unknown,
    context: Omit<ToolContext, "consent">,
  ): Promise<TOutput> {
    const tool = this.registry.get(name);
    if (!tool) {
      throw new Error(`Unknown tool: ${name}`);
    }

    this.permissions.require(tool.permissions);

    const parsedInput = tool.input_schema.safeParse(input);
    if (!parsedInput.success) {
      throw new Error(
        `Invalid input for ${name}: ${parsedInput.error.message}`,
      );
    }

    const fullContext: ToolContext = {
      ...context,
      consent: this.permissions.snapshot(),
    };

    const raw = await tool.run(parsedInput.data, fullContext);

    const parsedOutput = tool.output_schema.safeParse(raw);
    if (!parsedOutput.success) {
      throw new Error(
        `Invalid output for ${name}: ${parsedOutput.error.message}`,
      );
    }

    return parsedOutput.data as TOutput;
  }
}