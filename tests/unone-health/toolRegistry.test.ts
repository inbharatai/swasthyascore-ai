import { describe, expect, it } from "vitest";
import { ToolRegistry } from "@/modules/unone-health/core/toolRegistry";
import type { ToolDescriptor } from "@/modules/unone-health/core/types";
import { z } from "zod";

const stubTool: ToolDescriptor = {
  name: "stub.do",
  namespace: "health.sync",
  description: "stub",
  permissions: [],
  offline_supported: true,
  input_schema: z.object({ value: z.number() }),
  output_schema: z.object({ doubled: z.number() }),
  safety_flags: [],
  run: async (input) => ({ doubled: (input as { value: number }).value * 2 }),
};

describe("ToolRegistry", () => {
  it("registers, retrieves and counts tools", () => {
    const registry = new ToolRegistry();
    registry.register(stubTool);
    expect(registry.has("stub.do")).toBe(true);
    expect(registry.get("stub.do")?.name).toBe("stub.do");
    expect(registry.size()).toBe(1);
    expect(registry.names()).toEqual(["stub.do"]);
  });

  it("rejects duplicate registration", () => {
    const registry = new ToolRegistry();
    registry.register(stubTool);
    expect(() => registry.register(stubTool)).toThrow();
  });

  it("filters by namespace", () => {
    const registry = new ToolRegistry();
    registry.register(stubTool);
    expect(registry.listByNamespace("health.sync")).toHaveLength(1);
    expect(registry.listByNamespace("health.vitals")).toHaveLength(0);
  });
});