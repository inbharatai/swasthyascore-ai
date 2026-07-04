import { describe, expect, it } from "vitest";
import {
  smoothPoint,
  smoothLandmarks,
  landmarkDistance,
  type Point,
} from "@/modules/unone-health/health-skills/rppg-vital-scan/landmarkSmoothing";

describe("smoothPoint", () => {
  it("seeds with the raw value on the first frame (prev = null)", () => {
    const p = smoothPoint(null, { x: 0.5, y: 0.3 }, 0.5);
    expect(p).toEqual({ x: 0.5, y: 0.3 });
  });

  it("blends prev and raw by alpha (mid-life)", () => {
    // 0.5 * 0.6 + 0.5 * 0.2 = 0.4 ; 0.5 * 0.4 + 0.5 * 0.8 = 0.6
    const p = smoothPoint({ x: 0.2, y: 0.8 }, { x: 0.6, y: 0.4 }, 0.5);
    expect(p.x).toBeCloseTo(0.4, 6);
    expect(p.y).toBeCloseTo(0.6, 6);
  });

  it("returns the raw value when alpha = 1 (no smoothing)", () => {
    const p = smoothPoint({ x: 0.2, y: 0.8 }, { x: 0.6, y: 0.4 }, 1);
    expect(p).toEqual({ x: 0.6, y: 0.4 });
  });

  it("returns prev when alpha = 0 (frozen)", () => {
    const p = smoothPoint({ x: 0.2, y: 0.8 }, { x: 0.6, y: 0.4 }, 0);
    expect(p).toEqual({ x: 0.2, y: 0.8 });
  });

  it("clamps a non-finite alpha back to the 0.5 default", () => {
    const p = smoothPoint({ x: 0.2, y: 0.8 }, { x: 0.6, y: 0.4 }, Number.NaN);
    expect(p.x).toBeCloseTo(0.4, 6);
    expect(p.y).toBeCloseTo(0.6, 6);
  });
});

describe("smoothLandmarks", () => {
  it("seeds every raw key on the first call (prev = null)", () => {
    const out = smoothLandmarks(null, { 1: { x: 0.5, y: 0.5 }, 10: { x: 0.1, y: 0.2 } }, 0.5);
    expect(out[1]).toEqual({ x: 0.5, y: 0.5 });
    expect(out[10]).toEqual({ x: 0.1, y: 0.2 });
  });

  it("blends each key against the previous frame and never mutates prev", () => {
    const prev = { 1: { x: 0.2, y: 0.8 } } as Partial<Record<number, Point>>;
    const raw = { 1: { x: 0.6, y: 0.4 } };
    const out = smoothLandmarks(prev, raw, 0.5);
    expect(out[1]?.x).toBeCloseTo(0.4, 6);
    expect(out[1]?.y).toBeCloseTo(0.6, 6);
    // prev is untouched (pure).
    expect(prev[1]).toEqual({ x: 0.2, y: 0.8 });
  });

  it("accumulates over frames so a constant noisy target converges to its mean", () => {
    // Simulate a landmark that's truly fixed at (0.5, 0.5) but is reported with a
    // ±0.02 jitter each frame. The EMA should converge toward (0.5, 0.5) and
    // the smoothed trace's spread must be SMALLER than the raw trace's spread.
    let prev: Partial<Record<number, Point>> | null = null;
    const smoothed: Point[] = [];
    const raw: Point[] = [];
    let phase = 0;
    for (let i = 0; i < 60; i++) {
      const jx = ((phase % 4) - 1.5) * 0.02; // -0.03..+0.03 deterministic jitter
      const jy = (((phase + 1) % 4) - 1.5) * 0.02;
      phase++;
      const r = { x: 0.5 + jx, y: 0.5 + jy };
      raw.push(r);
      prev = smoothLandmarks(prev, { 1: r }, 0.5);
      smoothed.push(prev[1]!);
    }
    const spread = (xs: Point[]) => {
      const mx = xs.reduce((a, b) => a + b.x, 0) / xs.length;
      const my = xs.reduce((a, b) => a + b.y, 0) / xs.length;
      return xs.reduce((a, b) => a + Math.hypot(b.x - mx, b.y - my), 0) / xs.length;
    };
    // Discard the first few frames (warmup) so seeding doesn't skew the spread.
    expect(spread(smoothed.slice(10))).toBeLessThan(spread(raw.slice(10)));
    // And the tail of the smoothed trace stays well inside the jitter amplitude
    // (|x-0.5| < 0.03), proving the EMA has collapsed toward the true centre
    // rather than tracking the raw ±0.03 swing.
    const tail = smoothed[smoothed.length - 1];
    expect(Math.abs(tail.x - 0.5)).toBeLessThan(0.02);
    expect(Math.abs(tail.y - 0.5)).toBeLessThan(0.02);
  });

  it("drops keys missing from raw and seeds keys new to raw", () => {
    const prev = { 1: { x: 0.2, y: 0.8 }, 99: { x: 0.0, y: 0.0 } };
    const raw = { 1: { x: 0.6, y: 0.4 }, 50: { x: 0.7, y: 0.7 } };
    const out = smoothLandmarks(prev, raw, 0.5);
    expect(out[1]).toBeDefined();
    expect(out[50]).toEqual({ x: 0.7, y: 0.7 }); // new key seeds raw
    expect(out[99]).toBeUndefined(); // dropped — ROI uses fewer regions that frame
  });
});

describe("landmarkDistance", () => {
  it("returns the Euclidean distance between two landmarks", () => {
    const lm = { 33: { x: 0.3, y: 0.4 }, 263: { x: 0.7, y: 0.4 } };
    expect(landmarkDistance(lm, 33, 263)).toBeCloseTo(0.4, 6);
  });

  it("returns 0 when either landmark is missing", () => {
    expect(landmarkDistance({ 33: { x: 0.3, y: 0.4 } }, 33, 263)).toBe(0);
    expect(landmarkDistance({}, 33, 263)).toBe(0);
  });
});