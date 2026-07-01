import type { ToolDescriptor, ToolNamespace } from "./types";

/**
 * Generic tool registry. The runtime is health-agnostic; every health-specific
 * behaviour lives in the skill that registers the tool.
 */
export class ToolRegistry {
  private readonly tools = new Map<string, ToolDescriptor>();

  register(tool: ToolDescriptor): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool already registered: ${tool.name}`);
    }
    this.tools.set(tool.name, tool);
  }

  get(name: string): ToolDescriptor | undefined {
    return this.tools.get(name);
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  list(): ToolDescriptor[] {
    return [...this.tools.values()];
  }

  listByNamespace(namespace: ToolNamespace): ToolDescriptor[] {
    return this.list().filter((tool) => tool.namespace === namespace);
  }

  names(): string[] {
    return [...this.tools.keys()];
  }

  size(): number {
    return this.tools.size;
  }
}