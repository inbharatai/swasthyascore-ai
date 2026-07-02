import { describe, expect, it } from "vitest";
import { computeWaveformPoints } from "@/modules/unone-health/health-skills/rppg-vital-scan/waveform";

describe("computeWaveformPoints — live PPG waveform math", () => {
  it("returns one point per input sample, evenly spaced across the width", () => {
    const samples = [10, 11, 12, 11, 10, 9, 10, 11, 12, 11];
    const points = computeWaveformPoints(samples, 300, 60);
    expect(points).toHaveLength(samples.length);
    expect(points[0].x).toBeCloseTo(0, 5);
    expect(points[points.length - 1].x).toBeCloseTo(300, 5);
    // Even spacing: x[i] = (i / (n-1)) * width.
    for (let i = 0; i < points.length; i++) {
      expect(points[i].x).toBeCloseTo((i / (samples.length - 1)) * 300, 5);
    }
  });

  it("normalizes the trace to the vertical midline with the peak within bounds", () => {
    const samples = [0, 1, -1, 0, 1, -1, 0];
    const points = computeWaveformPoints(samples, 200, 80);
    const mid = 80 / 2;
    const ys = points.map((p) => p.y);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    // Centered on the midline with symmetric excursion: the peak (smallest y,
    // highest on screen) sits above mid; the trough (largest y) sits below mid.
    expect(minY).toBeLessThan(mid);
    expect(maxY).toBeGreaterThan(mid);
    // Symmetric excursion around the midline.
    expect(mid - minY).toBeCloseTo(maxY - mid, 5);
    // Amplitude capped at ~42% of height, well inside [0, height].
    expect(minY).toBeGreaterThanOrEqual(0);
    expect(maxY).toBeLessThanOrEqual(80);
  });

  it("returns a flat line at the midline for a pulse-less (flat) signal — no NaN/Infinity", () => {
    const flat = [5, 5, 5, 5, 5, 5];
    const points = computeWaveformPoints(flat, 120, 50);
    expect(points).toHaveLength(flat.length);
    const mid = 50 / 2;
    for (const p of points) {
      expect(Number.isFinite(p.y)).toBe(true);
      expect(p.y).toBeCloseTo(mid, 5);
    }
  });

  it("guards degenerate inputs (empty / zero size) by returning no points", () => {
    expect(computeWaveformPoints([], 300, 60)).toEqual([]);
    expect(computeWaveformPoints([1, 2, 3], 0, 60)).toEqual([]);
    expect(computeWaveformPoints([1, 2, 3], 300, 0)).toEqual([]);
  });

  it("maps a single sample to a single midline point", () => {
    const points = computeWaveformPoints([7], 300, 60);
    expect(points).toHaveLength(1);
    expect(points[0].x).toBe(0);
    expect(points[0].y).toBeCloseTo(30, 5);
  });
});