import { describe, expect, it } from "vitest";
import { createUnoOneHealthRuntime } from "@/lib/unone-health";
import {
  FingerFrameProvider,
  SignalRppgEngine,
} from "@/modules/unone-health/health-skills/rppg-vital-scan/browserRppg";

const EXPECTED_TOOLS = [
  "health.vitals.rppg_scan",
  "health.lab.extract_markers",
  "health.symptoms.collect",
  "health.voice.summarize",
  "health.reasoning.generate_plan",
  "health.record.save",
  "health.sync.queue",
];

/**
 * The rPPG tool is registered ONLY when a real engine is supplied (there is no
 * default/mock engine — a real scan always reads the camera). Build a real
 * `SignalRppgEngine` bound to a real `FingerFrameProvider`. The provider's
 * constructor only stores the video element; it never touches the DOM until
 * `sample()`/`scan()` run, and these registration tests never invoke them, so
 * this is safe in the Node test environment.
 */
function runtimeWithRealEngine() {
  const provider = new FingerFrameProvider({} as never);
  return createUnoOneHealthRuntime(new SignalRppgEngine(provider));
}

describe("UnoOne Health runtime registration", () => {
  it("registers all seven tools with full metadata when a real engine is supplied", () => {
    const runtime = runtimeWithRealEngine();
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

  it("does NOT register the rPPG tool when no engine is supplied (no default engine)", () => {
    const runtime = createUnoOneHealthRuntime();
    const tools = runtime.tools.list();
    expect(tools).toHaveLength(6);
    expect(runtime.tools.get("health.vitals.rppg_scan")).toBeUndefined();
    // the non-camera tools are still present
    expect(runtime.tools.get("health.lab.extract_markers")).toBeDefined();
    expect(runtime.tools.get("health.symptoms.collect")).toBeDefined();
  });

  it("rppg scan tool is offline-capable and forbids raw face video", () => {
    const runtime = runtimeWithRealEngine();
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