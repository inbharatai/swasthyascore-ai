import { describe, expect, it } from "vitest";
import { createUnoOneHealthRuntime } from "@/lib/unone-health";

const EXPECTED_TOOLS = [
  "health.vitals.rppg_scan",
  "health.lab.extract_markers",
  "health.symptoms.collect",
  "health.voice.summarize",
  "health.reasoning.generate_plan",
  "health.record.save",
  "health.sync.queue",
];

describe("UnoOne Health runtime registration", () => {
  it("registers all seven tools with full metadata", () => {
    const runtime = createUnoOneHealthRuntime();
    const tools = runtime.tools.list();
    expect(tools).toHaveLength(7);

    for (const name of EXPECTED_TOOLS) {
      const tool = runtime.tools.get(name);
      expect(tool, `missing tool ${name}`).toBeDefined();
      expect(tool?.namespace).toMatch(/^health\./);
      expect(tool?.description.length).toBeGreaterThan(0);
      expect(tool?.permissions).toBeInstanceOf(Array);
      expect(tool?.safety_flags).toBeInstanceOf(Array);
    }
  });

  it("rppg scan tool is offline-capable and forbids raw face video", () => {
    const runtime = createUnoOneHealthRuntime();
    const tool = runtime.tools.get("health.vitals.rppg_scan");
    expect(tool?.offline_supported).toBe(true);
    expect(tool?.safety_flags).toContain("no_raw_face_video");
    expect(tool?.permissions).toContain("camera");
  });

  it("lab lens requires consent + network and is not offline", () => {
    const runtime = createUnoOneHealthRuntime();
    const tool = runtime.tools.get("health.lab.extract_markers");
    expect(tool?.offline_supported).toBe(false);
    expect(tool?.permissions).toContain("lab_consent");
    expect(tool?.permissions).toContain("network");
  });
});