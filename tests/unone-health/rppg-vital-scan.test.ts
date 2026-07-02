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
 * Build a real-shape RGB trace at a target heart rate. This is a synthetic
 * signal fixture (pure math) that exercises the REAL pipeline
 * (aggregateFrameSamples -> finalizeVitalScan -> POS -> SPA -> zero-phase
 * bandpass -> Welch + autocorrelation); it is not a stand-in "engine" and
 * never ships.
 *
 * The pulse is carried in ALL THREE channels with realistic per-channel
 * amplitudes (green strongest, red moderate, blue weakest) — POS projects the
 * plane orthogonal to skin tone, so r=g=b would give a degenerate (zero)
 * signal. An optional breath overlay (0.1–0.5 Hz) is added to the green channel
 * for the respiratory-rate test.
 */
function pulseChannels(
  t: number,
  hz: number,
  breathHz = 0,
): { r: number; g: number; b: number } {
  const pulse = Math.sin(2 * Math.PI * hz * t);
  const breath = breathHz > 0 ? Math.sin(2 * Math.PI * breathHz * t) : 0;
  return {
    r: 130 + pulse * 3,
    g: 128 + pulse * 5 + breath * 5,
    b: 126 + pulse * 2,
  };
}

function syntheticFrames(
  hz: number,
  seconds: number,
  quality = 0.9,
  breathHz = 0,
): RppgFrameSample[] {
  const frames: RppgFrameSample[] = [];
  const n = FPS * seconds;
  for (let i = 0; i < n; i++) {
    const t = i / FPS;
    const { r, g, b } = pulseChannels(t, hz, breathHz);
    frames.push({
      greenMean: g,
      redMean: r,
      blueMean: b,
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
    redMean: 130,
    blueMean: 126,
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
  it("recovers a plausible heart rate from a clean RGB trace (POS)", () => {
    // 1.2 Hz = 72 BPM, inside the 0.7-3.0 Hz HR band. POS combines R/G/B.
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
    // Finger mode never produces RR. Face mode ran the full pipeline and produced
    // a heart rate (the no-breath fixture here yields no RR — the 0.25 Hz breath
    // test below covers the face RR-produced direction).
    expect(fingerResult.respiratory_rate_bpm).toBeNull();
    expect(faceResult.heart_rate_bpm).not.toBeNull();
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
    const frames = syntheticFrames(1.2, 20, 0.9, 0.25);
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
    // Genuinely broadband in-band noise: a sum of 12 sinusoids spread across
    // 0.4–3.6 Hz with deterministic per-channel phases. This has NO single
    // dominant peak, so rdspSQI (tallest/2nd) stays < 2 and the per-window
    // autocorrelation disagrees across windows — the gates must reject it so
    // neither rate is invented. (A pure LCG was rejected as too colored: with
    // only ~3 Welch segments it could spuriously clear rdspSqi ≥ 2.)
    const freqs = [0.4, 0.65, 0.9, 1.15, 1.4, 1.65, 1.9, 2.15, 2.4, 2.65, 2.9, 3.6];
    const phasesR = [0.1, 1.2, 2.3, 0.7, 1.9, 0.3, 2.8, 1.1, 0.5, 2.0, 1.4, 0.9];
    const phasesG = [2.2, 0.4, 1.7, 2.9, 0.6, 1.3, 0.2, 2.5, 1.8, 0.8, 2.1, 1.0];
    const phasesB = [1.5, 2.7, 0.3, 1.1, 2.0, 0.9, 1.6, 0.5, 2.4, 1.2, 0.7, 2.6];
    const frames: RppgFrameSample[] = [];
    const n = FPS * 20;
    for (let i = 0; i < n; i++) {
      const t = i / FPS;
      let r = 130;
      let g = 128;
      let b = 126;
      for (let k = 0; k < freqs.length; k++) {
        r += Math.sin(2 * Math.PI * freqs[k] * t + phasesR[k]) * 3;
        g += Math.sin(2 * Math.PI * freqs[k] * t + phasesG[k]) * 3;
        b += Math.sin(2 * Math.PI * freqs[k] * t + phasesB[k]) * 3;
      }
      frames.push({
        greenMean: g,
        redMean: r,
        blueMean: b,
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
    expect(result.heart_rate_bpm).toBeNull();
    expect(result.respiratory_rate_bpm).toBeNull();
  });
});