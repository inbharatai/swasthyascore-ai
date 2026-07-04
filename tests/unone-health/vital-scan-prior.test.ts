import { describe, expect, it } from "vitest";
import {
  aggregateFrameSamples,
  finalizeVitalScan,
  type RppgFrameSample,
} from "@/lib/unone-health";

const FIXED_NOW = "2026-07-04T00:00:00.000Z";
const FPS = 30;

/** Same clean RGB fixture the main suite uses (1.2 Hz / 72 BPM, all three
 * channels, high per-frame quality → high SNR). */
function cleanFrames(hz: number, seconds: number): RppgFrameSample[] {
  const frames: RppgFrameSample[] = [];
  const n = FPS * seconds;
  for (let i = 0; i < n; i++) {
    const t = i / FPS;
    const pulse = Math.sin(2 * Math.PI * hz * t);
    frames.push({
      greenMean: 128 + pulse * 5,
      redMean: 130 + pulse * 3,
      blueMean: 126 + pulse * 2,
      timestampMs: Math.round(t * 1000),
      faceStability: 0.9,
      motionScore: 0.9,
      lightingScore: 0.9,
      leftRightConsistency: 0.9,
    });
  }
  return frames;
}

describe("finalizeVitalScan — priorBpm forwarding", () => {
  it("accepts an optional 5th priorBpm argument and does not override a confident reading", () => {
    const samples = aggregateFrameSamples(cleanFrames(1.2, 20));
    // A confident 72 BPM capture. Pass a misleading prior of 144 (the 2nd
    // harmonic). The estimator only consults the prior when SNR < 0.3, so the
    // high-SNR reading must stand at ~72 BPM, not be reconciled toward 144.
    const result = finalizeVitalScan(
      samples,
      { cameraMode: "front_face", durationSeconds: 20 },
      "signal",
      FIXED_NOW,
      144,
    );
    expect(result.heart_rate_bpm).not.toBeNull();
    expect(result.heart_rate_bpm!).toBeGreaterThanOrEqual(64);
    expect(result.heart_rate_bpm!).toBeLessThanOrEqual(80);
  });

  it("omitting priorBpm (the legacy 4-arg call) is still valid", () => {
    const samples = aggregateFrameSamples(cleanFrames(1.2, 20));
    const result = finalizeVitalScan(
      samples,
      { cameraMode: "front_face", durationSeconds: 20 },
      "signal",
      FIXED_NOW,
    );
    expect(result.heart_rate_bpm).not.toBeNull();
    expect(result.heart_rate_bpm!).toBeGreaterThanOrEqual(64);
    expect(result.heart_rate_bpm!).toBeLessThanOrEqual(80);
  });
});