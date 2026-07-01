import { describe, expect, it } from "vitest";
import {
  detectRedFlags,
  EMERGENCY_RED_FLAGS,
  scanForUnsafeWording,
  SAFETY_NOTE,
} from "@/modules/unone-health/core/safety";

describe("safety wording guard", () => {
  it("flags diagnosis phrasing", () => {
    const scan = scanForUnsafeWording("You have diabetes and hypertension.");
    expect(scan.clean).toBe(false);
    expect(scan.diagnosisClaims.length).toBeGreaterThan(0);
  });

  it("flags prescription phrasing", () => {
    const scan = scanForUnsafeWording("Take 500mg metformin twice daily.");
    expect(scan.clean).toBe(false);
    expect(scan.prescriptionClaims.length).toBeGreaterThan(0);
  });

  it("passes clean advisory text", () => {
    const scan = scanForUnsafeWording(
      "This marker may suggest risk and should be discussed with a doctor.",
    );
    expect(scan.clean).toBe(true);
  });

  it("exposes a non-diagnostic safety note", () => {
    expect(SAFETY_NOTE).toContain("not a diagnosis");
  });
});

describe("emergency red-flag detection", () => {
  it("detects chest pain", () => {
    expect(detectRedFlags("I have chest pain and shortness of breath")).toContain("chest pain");
  });

  it("detects stroke signs", () => {
    const flags = detectRedFlags("Face drooping and speech difficulty");
    expect(flags).toContain("face drooping");
    expect(flags).toContain("speech difficulty");
  });

  it("detects blue lips", () => {
    expect(detectRedFlags("blue lips")).toContain("blue lips");
  });

  it("returns empty for non-emergency text", () => {
    expect(detectRedFlags("I feel a bit tired")).toHaveLength(0);
  });

  it("ships a fixed emergency flag list", () => {
    expect(EMERGENCY_RED_FLAGS).toContain("chest pain");
    expect(EMERGENCY_RED_FLAGS).toContain("severe breathlessness");
    expect(EMERGENCY_RED_FLAGS).toContain("pregnancy complication");
  });
});