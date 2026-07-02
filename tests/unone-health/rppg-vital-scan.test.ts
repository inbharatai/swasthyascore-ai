import { describe, expect, it } from "vitest";
import {
  aggregateFrameSamples,
  computeConfidence,
  finalizeVitalScan,
  labelForConfidence,
  type RppgFrameSample,
} from "@/lib/unone-health";

const FIXED_NOW = "2026-07-01T00:00:00.000Z";
const FPS = 30;

/**
 * Build a real-shape green-channel trace at a target heart rate. This is a
 * synthetic signal fixture (pure math) that exercises the REAL pipeline
 * (aggregateFrameSamples -> finalizeVitalScan -> bandpass -> autocorrelation);
 * it is not a stand-in "engine" and never ships.
 */
function syntheticFrames(
  hz: number,
  seconds: number,
  quality = 0.9,
): RppgFrameSample[] {
  const frames: RppgFrameSample[] = [];
  const n = FPS * seconds;
  for (let i = 0; i < n; i++) {
    const t = i / FPS;
    frames.push({
      greenMean: 128 + Math.sin(2 * Math.PI * hz * t) * 0.06,
      timestampMs: Math.round(t * 1000),
      faceStability: quality,
      motionScore: quality,
      lightingScore: quality,
      leftRightConsistency: quality,
    });
  }
  return frames;
}

function flatFrames(count: number, quality: number): RppgFrameSample[] {
  return Array.from({ length: count }, (_, i) => ({
    greenMean: 128,
    timestampMs: i * 33,
    faceStability: quality,
    motionScore: quality,
    lightingScore: quality,
    leftRightConsistency: quality,
  }));
}

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

describe("rPPG signal pipeline", () => {
  it("recovers a plausible heart rate from a clean green-channel trace", () => {
    // 1.2 Hz = 72 BPM, inside the 0.75-3.0 Hz HR band.
    const samples = aggregateFrameSamples(syntheticFrames(1.2, 20));
    const result = finalizeVitalScan(
      samples,
      { cameraMode: "front_face", durationSeconds: 20 },
      "signal",
      FIXED_NOW,
    );

    expect(result.engine).toBe("signal");
    expect(result.event_type).toBe("vital_scan");
    expect(result.source).toBe("unone_health");
    expect(result.raw_video_uploaded).toBe(false);
    expect(result.heart_rate_bpm).not.toBeNull();
    expect(result.heart_rate_bpm!).toBeGreaterThanOrEqual(60);
    expect(result.heart_rate_bpm!).toBeLessThanOrEqual(90);
    expect(result.confidence).toBeGreaterThanOrEqual(0.6);
    expect(result.confidence_label).not.toBe("fail");
  });

  it("respiratory rate is only produced for front-face mode", () => {
    const face = aggregateFrameSamples(syntheticFrames(1.2, 20));
    const finger = aggregateFrameSamples(syntheticFrames(1.2, 20));
    const faceResult = finalizeVitalScan(
      face,
      { cameraMode: "front_face", durationSeconds: 20 },
      "signal",
      FIXED_NOW,
    );
    const fingerResult = finalizeVitalScan(
      finger,
      { cameraMode: "rear_finger", durationSeconds: 20 },
      "signal",
      FIXED_NOW,
    );
    // RR may be null even in face mode (best-effort), but is ALWAYS null for finger.
    expect(fingerResult.respiratory_rate_bpm).toBeNull();
    void faceResult;
  });
});

describe("rPPG low confidence + fail policy", () => {
  it("nulls HR/RR and recommends repeat on fail", () => {
    const frames = flatFrames(30, 0.1); // flat line — no pulse, poor quality
    const result = finalizeVitalScan(
      aggregateFrameSamples(frames),
      { cameraMode: "front_face", durationSeconds: 20 },
      "signal",
      FIXED_NOW,
    );

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
    const result = finalizeVitalScan(
      aggregateFrameSamples(frames),
      { cameraMode: "front_face", durationSeconds: 20 },
      "signal",
      FIXED_NOW,
    );
    // With all sub-scores at 0.5 and a weak signal, confidence lands ~0.45 (low),
    // which must recommend a repeat scan. Assert directly.
    expect(result.confidence_label).toBe("low");
    expect(result.repeat_scan_recommended).toBe(true);
  });
});

describe("rPPG respiratory-rate accuracy + noise rejection", () => {
  it("recovers a 0.25 Hz (15 rpm) respiratory signal overlaid on the HR trace", () => {
    // 1.2 Hz HR + 0.25 Hz breathing, 20s. The 0.1–0.5 Hz bandpass must isolate
    // the breath component and the stricter 0.35 energy gate must still accept it.
    const frames: RppgFrameSample[] = [];
    const n = FPS * 20;
    for (let i = 0; i < n; i++) {
      const t = i / FPS;
      frames.push({
        greenMean:
          128 +
          Math.sin(2 * Math.PI * 1.2 * t) * 0.06 +
          Math.sin(2 * Math.PI * 0.25 * t) * 0.05,
        timestampMs: Math.round(t * 1000),
        faceStability: 0.9,
        motionScore: 0.9,
        lightingScore: 0.9,
        leftRightConsistency: 0.9,
      });
    }
    const result = finalizeVitalScan(
      aggregateFrameSamples(frames),
      { cameraMode: "front_face", durationSeconds: 20 },
      "signal",
      FIXED_NOW,
    );
    expect(result.respiratory_rate_bpm).not.toBeNull();
    expect(result.respiratory_rate_bpm!).toBeGreaterThanOrEqual(12);
    expect(result.respiratory_rate_bpm!).toBeLessThanOrEqual(18);
  });

  it("rejects a noisy trace: HR and RR both null (no fabricated rates)", () => {
    // LCG noise + good-quality scores — the energy gates (HR 0.2, RR 0.35) must
    // both reject, so neither rate is invented. This is the end-to-end guard.
    const frames: RppgFrameSample[] = [];
    let state = 424242;
    const n = FPS * 20;
    for (let i = 0; i < n; i++) {
      state = (state * 1103515245 + 12345) & 0x7fffffff;
      frames.push({
        greenMean: 128 + (state / 0x7fffffff - 0.5) * 20,
        timestampMs: Math.round((i / FPS) * 1000),
        faceStability: 0.9,
        motionScore: 0.9,
        lightingScore: 0.9,
        leftRightConsistency: 0.9,
      });
    }
    const result = finalizeVitalScan(
      aggregateFrameSamples(frames),
      { cameraMode: "front_face", durationSeconds: 20 },
      "signal",
      FIXED_NOW,
    );
    expect(result.heart_rate_bpm).toBeNull();
    expect(result.respiratory_rate_bpm).toBeNull();
  });
});