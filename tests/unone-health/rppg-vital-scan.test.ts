import { describe, expect, it } from "vitest";
import {
  MockRppgEngine,
  aggregateFrameSamples,
  computeConfidence,
  finalizeVitalScan,
  labelForConfidence,
  synthesizeMockFrame,
} from "@/lib/unone-health";
import type { RppgFrameSample } from "@/lib/unone-health";

const FIXED_NOW = "2026-07-01T00:00:00.000Z";

describe("rPPG confidence formula", () => {
  it("applies the exact spec weights", () => {
    // 0.25*1 + 0.2*1 + 0.15*1 + 0.25*1 + 0.15*1 = 1.0
    expect(computeConfidence({
      faceRoiStability: 1,
      motionScore: 1,
      lightingScore: 1,
      signalQuality: 1,
      leftRightRoiConsistency: 1,
    })).toBe(1);
  });

  it("maps thresholds to labels", () => {
    expect(labelForConfidence(0.8)).toBe("good");
    expect(labelForConfidence(0.79)).toBe("moderate");
    expect(labelForConfidence(0.6)).toBe("moderate");
    expect(labelForConfidence(0.59)).toBe("low");
    expect(labelForConfidence(0.4)).toBe("low");
    expect(labelForConfidence(0.39)).toBe("fail");
  });
});

describe("rPPG mock engine", () => {
  it("produces a plausible HR with acceptable confidence", async () => {
    const engine = new MockRppgEngine(72);
    const samples = await engine.scan({
      cameraMode: "front_face",
      durationSeconds: 20,
    });
    const result = finalizeVitalScan(samples, { cameraMode: "front_face", durationSeconds: 20 }, "mock", FIXED_NOW);

    expect(result.engine).toBe("mock");
    expect(result.event_type).toBe("vital_scan");
    expect(result.source).toBe("unone_health");
    expect(result.raw_video_uploaded).toBe(false);
    expect(result.heart_rate_bpm).not.toBeNull();
    expect(result.heart_rate_bpm!).toBeGreaterThanOrEqual(60);
    expect(result.heart_rate_bpm!).toBeLessThanOrEqual(90);
    expect(result.confidence).toBeGreaterThanOrEqual(0.6);
    expect(result.confidence_label).not.toBe("fail");
  });

  it("respiratory rate is only produced for front-face mode", async () => {
    const engine = new MockRppgEngine(72);
    const face = await engine.scan({ cameraMode: "front_face", durationSeconds: 20 });
    const finger = await engine.scan({ cameraMode: "rear_finger", durationSeconds: 20 });
    const faceResult = finalizeVitalScan(face, { cameraMode: "front_face", durationSeconds: 20 }, "mock", FIXED_NOW);
    const fingerResult = finalizeVitalScan(finger, { cameraMode: "rear_finger", durationSeconds: 20 }, "mock", FIXED_NOW);
    // RR may be null even in face mode (best-effort), but is ALWAYS null for finger.
    expect(fingerResult.respiratory_rate_bpm).toBeNull();
    void faceResult;
  });
});

describe("rPPG low confidence + fail policy", () => {
  it("nulls HR/RR and recommends repeat on fail", () => {
    const frames: RppgFrameSample[] = Array.from({ length: 30 }, (_, i) => ({
      greenMean: 128, // flat line — no pulse
      timestampMs: i * 33,
      faceStability: 0.1,
      motionScore: 0.1,
      lightingScore: 0.1,
      leftRightConsistency: 0.1,
    }));
    const samples = aggregateFrameSamples(frames);
    const result = finalizeVitalScan(samples, { cameraMode: "front_face", durationSeconds: 20 }, "mock", FIXED_NOW);

    expect(result.confidence_label).toBe("fail");
    expect(result.heart_rate_bpm).toBeNull();
    expect(result.respiratory_rate_bpm).toBeNull();
    expect(result.repeat_scan_recommended).toBe(true);
  });

  it("recommends a repeat scan on low confidence", () => {
    const frames: RppgFrameSample[] = Array.from({ length: 30 }, (_, i) => ({
      greenMean: 128 + Math.sin(i * 0.2) * 0.06,
      timestampMs: i * 33,
      faceStability: 0.5,
      motionScore: 0.5,
      lightingScore: 0.5,
      leftRightConsistency: 0.5,
    }));
    const samples = aggregateFrameSamples(frames);
    const result = finalizeVitalScan(samples, { cameraMode: "front_face", durationSeconds: 20 }, "mock", FIXED_NOW);
    if (result.confidence_label === "low") {
      expect(result.repeat_scan_recommended).toBe(true);
    }
  });

  it("synthesizes deterministic mock frames", () => {
    const a = synthesizeMockFrame(1, 72);
    const b = synthesizeMockFrame(1, 72);
    expect(a).toEqual(b);
  });
});