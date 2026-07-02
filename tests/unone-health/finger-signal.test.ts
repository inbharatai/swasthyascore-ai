import { describe, expect, it } from "vitest";
import {
  computeFingerSignalQuality,
  FINGER_WINDOW,
} from "@/modules/unone-health/health-skills/rppg-vital-scan/fingerSignal";

const SAMPLE_RATE = 30;

/** A clean 1.2 Hz (72 BPM) pulsing red trace at ~150 DC with AC amplitude ~2. */
function pulsingRed(n: number, hz = 1.2, dc = 150, amp = 2): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    out.push(dc + Math.sin((2 * Math.PI * hz * i) / SAMPLE_RATE) * amp);
  }
  return out;
}

describe("computeFingerSignalQuality — motion", () => {
  it("scores ~1 (still) when the last frame barely moved", () => {
    const reds = pulsingRed(30);
    const prev = reds[reds.length - 2];
    const q = computeFingerSignalQuality({
      recentReds: reds,
      prevRed: prev,
      brightness: 160,
    });
    // A pulse-driven delta of <0.5 units must read as essentially still.
    expect(q.motionScore).toBeGreaterThan(0.9);
  });

  it("drops sharply when the finger slips (large frame-to-frame delta)", () => {
    const reds = pulsingRed(30);
    const last = reds[reds.length - 1];
    const q = computeFingerSignalQuality({
      recentReds: reds,
      prevRed: last - 25, // a 25-unit jump = obvious motion
      brightness: 160,
    });
    expect(q.motionScore).toBeLessThan(0.05);
  });
});

describe("computeFingerSignalQuality — stability", () => {
  it("is high for a steady pulse (low delta-variance)", () => {
    const reds = pulsingRed(30);
    const q = computeFingerSignalQuality({
      recentReds: reds,
      prevRed: reds[reds.length - 2],
      brightness: 160,
    });
    expect(q.stability).toBeGreaterThan(0.7);
  });

  it("collapses for erratic frame-to-frame changes (tremor)", () => {
    // Alternating big jumps: the delta series has huge variance.
    const reds: number[] = [];
    for (let i = 0; i < 30; i++) reds.push(150 + (i % 2 === 0 ? 0 : 20));
    const q = computeFingerSignalQuality({
      recentReds: reds,
      prevRed: reds[reds.length - 2],
      brightness: 160,
    });
    expect(q.stability).toBeLessThan(0.2);
  });
});

describe("computeFingerSignalQuality — pulsatility (AC/DC)", () => {
  it("rises with pulse amplitude (stronger PPG => higher AC/DC)", () => {
    const weak = pulsingRed(30, 1.2, 150, 0.5); // AC/DC ~0.003
    const strong = pulsingRed(30, 1.2, 150, 6); // AC/DC ~0.04 -> clamped to 1
    const qWeak = computeFingerSignalQuality({
      recentReds: weak,
      prevRed: weak[weak.length - 2],
      brightness: 160,
    });
    const qStrong = computeFingerSignalQuality({
      recentReds: strong,
      prevRed: strong[strong.length - 2],
      brightness: 160,
    });
    expect(qStrong.pulsatility).toBeGreaterThan(qWeak.pulsatility);
    expect(qStrong.pulsatility).toBeCloseTo(1, 0); // saturated
  });

  it("is ~0 for a flat line (no pulse)", () => {
    const flat = new Array(30).fill(150);
    const q = computeFingerSignalQuality({
      recentReds: flat,
      prevRed: 150,
      brightness: 160,
    });
    expect(q.pulsatility).toBe(0);
  });
});

describe("computeFingerSignalQuality — lighting", () => {
  it("scores 0.9 in the usable brightness band", () => {
    const reds = pulsingRed(30);
    const q = computeFingerSignalQuality({
      recentReds: reds,
      prevRed: reds[reds.length - 2],
      brightness: 160,
    });
    expect(q.lightingScore).toBe(0.9);
  });

  it("scores 0.2 when over-saturated (torch too close / blown out)", () => {
    const reds = pulsingRed(30);
    const q = computeFingerSignalQuality({
      recentReds: reds,
      prevRed: reds[reds.length - 2],
      brightness: 252,
    });
    expect(q.lightingScore).toBe(0.2);
  });

  it("scores 0.2 when too dark", () => {
    const reds = pulsingRed(30);
    const q = computeFingerSignalQuality({
      recentReds: reds,
      prevRed: reds[reds.length - 2],
      brightness: 30,
    });
    expect(q.lightingScore).toBe(0.2);
  });
});

describe("computeFingerSignalQuality — edge cases", () => {
  it("handles a near-empty buffer without throwing (pulsatility 0)", () => {
    const q = computeFingerSignalQuality({
      recentReds: [150],
      prevRed: null,
      brightness: 160,
    });
    expect(q.pulsatility).toBe(0);
    expect(q.motionScore).toBe(0.9); // no prev to compare -> default still
    expect(q.lightingScore).toBe(0.9);
  });

  it("all outputs are within [0,1]", () => {
    const reds = pulsingRed(FINGER_WINDOW, 1.2, 150, 50); // huge amp
    const q = computeFingerSignalQuality({
      recentReds: reds,
      prevRed: 100,
      brightness: 255,
    });
    for (const v of [q.motionScore, q.stability, q.pulsatility, q.lightingScore]) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});