import { describe, expect, it } from "vitest";
import {
  estimateHeartRateFromFrames,
  type HeartRateInput,
} from "@/modules/unone-health/health-skills/rppg-vital-scan/heartRate";

const FS = 30;

function buildInput(
  channels: { r: number[]; g: number[]; b: number[] },
  mode: HeartRateInput["mode"],
): HeartRateInput {
  const n = channels.r.length;
  const timestampsMs: number[] = [];
  for (let i = 0; i < n; i++) timestampsMs.push(Math.round((i / FS) * 1000));
  return {
    r: channels.r,
    g: channels.g,
    b: channels.b,
    timestampsMs,
    motion: new Array(n).fill(0.9),
    lighting: new Array(n).fill(0.9),
    stability: new Array(n).fill(0.9),
    mode,
  };
}

/** Realistic per-channel amplitudes (green strongest) for a clean face trace. */
function rgbPulse(hz: number, seconds: number) {
  const n = FS * seconds;
  const r: number[] = [];
  const g: number[] = [];
  const b: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / FS;
    const p = Math.sin(2 * Math.PI * hz * t);
    r.push(130 + p * 3);
    g.push(128 + p * 5);
    b.push(126 + p * 2);
  }
  return { r, g, b };
}

function redPulse(hz: number, seconds: number) {
  const n = FS * seconds;
  const r: number[] = [];
  const g: number[] = [];
  const b: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / FS;
    r.push(150 + Math.sin(2 * Math.PI * hz * t) * 4);
    g.push(0);
    b.push(0);
  }
  return { r, g, b };
}

// Each case: target BPM -> Hz. Tolerance ±6 BPM (one Welch bin at 30 Hz / 5 s
// segment ≈ 0.2 Hz ≈ 12 BPM, parabolic-interpolated to well under that; ±6 is
// a generous but honest accuracy bound across the physiological band).
const CASES: { bpm: number; hz: number }[] = [
  { bpm: 50, hz: 50 / 60 },
  { bpm: 60, hz: 60 / 60 },
  { bpm: 72, hz: 72 / 60 },
  { bpm: 90, hz: 90 / 60 },
  { bpm: 100, hz: 100 / 60 },
  { bpm: 120, hz: 120 / 60 },
];

describe("estimateHeartRateFromFrames — accuracy across the HR band", () => {
  for (const { bpm, hz } of CASES) {
    it(`face: recovers ${bpm} BPM (±6) from a clean ${hz.toFixed(3)} Hz RGB trace`, () => {
      const est = estimateHeartRateFromFrames(buildInput(rgbPulse(hz, 20), "front_face"));
      expect(est.bpm).not.toBeNull();
      expect(est.bpm!).toBeGreaterThanOrEqual(bpm - 6);
      expect(est.bpm!).toBeLessThanOrEqual(bpm + 6);
    });
  }
  for (const { bpm, hz } of CASES) {
    it(`finger: recovers ${bpm} BPM (±6) from a clean ${hz.toFixed(3)} Hz red trace`, () => {
      const est = estimateHeartRateFromFrames(buildInput(redPulse(hz, 20), "rear_finger"));
      expect(est.bpm).not.toBeNull();
      expect(est.bpm!).toBeGreaterThanOrEqual(bpm - 6);
      expect(est.bpm!).toBeLessThanOrEqual(bpm + 6);
    });
  }

  it("face at 50 BPM (0.833 Hz) is not halved to ~25 and not doubled to ~100", () => {
    const est = estimateHeartRateFromFrames(buildInput(rgbPulse(50 / 60, 20), "front_face"));
    expect(est.bpm).not.toBeNull();
    // The 0.7 Hz bandpass low-corner is close to 0.833 Hz; recovery here proves
    // the SPA/bandpass pair preserves the low-HR edge rather than attenuating it
    // into a null or a halving artefact.
    expect(est.bpm!).toBeGreaterThanOrEqual(44);
    expect(est.bpm!).toBeLessThanOrEqual(56);
  });
});