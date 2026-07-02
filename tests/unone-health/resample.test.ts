import { describe, expect, it } from "vitest";
import {
  resampleUniform,
  detectDropsAndDuplicates,
} from "@/modules/unone-health/health-skills/rppg-vital-scan/resample";
import { welchPsd, spectralPeak } from "@/modules/unone-health/health-skills/rppg-vital-scan/spectral";

const FS = 30;

describe("detectDropsAndDuplicates", () => {
  it("classifies duplicates (Δt < 0.5×median) and drops (Δt > 1.5×median)", () => {
    // Median cadence ~33 ms. Insert a duplicate (3 ms) and a drop (90 ms).
    const ts: number[] = [];
    for (let i = 0; i < 30; i++) ts.push(i * 33);
    ts.splice(10, 0, ts[10] + 3); // duplicate-ish (Δt 3 ms after frame 10)
    ts[20] = ts[19] + 90; // drop (90 ms gap)
    const { duplicates, drops, medianPeriodMs } = detectDropsAndDuplicates(ts);
    expect(medianPeriodMs).toBe(33);
    expect(duplicates).toBeGreaterThanOrEqual(1);
    expect(drops).toBeGreaterThanOrEqual(1);
  });

  it("returns zeros for < 2 samples", () => {
    expect(detectDropsAndDuplicates([42])).toEqual({
      duplicates: 0,
      drops: 0,
      medianPeriodMs: 0,
    });
  });
});

describe("resampleUniform (monotone cubic Hermite)", () => {
  it("recovers a 1.2 Hz sine from jittered + dropped timestamps", () => {
    // Build a clean 1.2 Hz sine, then sample it on a jittery grid with one
    // dropped frame (a 2-period gap). Resample back to 30 Hz and verify the
    // spectral peak is still 1.2 Hz — the interpolator must not invent peaks.
    const hz = 1.2;
    const values: number[] = [];
    const tsMs: number[] = [];
    let tMs = 0;
    const stepMs = 1000 / FS;
    for (let i = 0; i < 20 * FS; i++) {
      // Jitter ±5 ms; skip every 31st frame (a drop → 2-period gap).
      if (i % 31 === 0) {
        tMs += stepMs;
        continue;
      }
      const jitter = ((i * 7) % 11) - 5;
      tsMs.push(Math.round(tMs) + jitter);
      values.push(128 + Math.sin((2 * Math.PI * hz * tMs) / 1000) * 5);
      tMs += stepMs;
    }
    const res = resampleUniform(values, tsMs, FS);
    expect(res.values.length).toBeGreaterThan(FS * 15);
    expect(res.drops).toBeGreaterThan(0);
    const w = welchPsd(res.values, FS, 5, 0.5);
    const peak = spectralPeak(w.psd, w.freqs, 0.66, 3.0).hz;
    expect(peak).toBeGreaterThan(1.1);
    expect(peak).toBeLessThan(1.3);
  });

  it("collapses duplicate frames before interpolating", () => {
    // Two frames at the same timestamp (a rAF dup) must not create a zero-Δt
    // knot that breaks the interpolator; the duplicate is dropped. The
    // load-bearing contract is that the interpolator produces ONLY finite
    // values (a zero-Δt knot would yield NaN/Infinity from a division by zero
    // in the monotone-slope step). Spectral recovery of 1.2 Hz is covered by
    // the 20 s test above — this 1.3 s fixture is too short for Welch to resolve.
    const values: number[] = [];
    const tsMs: number[] = [];
    for (let i = 0; i < 40; i++) {
      tsMs.push(i * 33);
      values.push(128 + Math.sin((2 * Math.PI * 1.2 * i) / FS) * 5);
    }
    // Inject a duplicate.
    tsMs.splice(20, 0, tsMs[20]);
    values.splice(20, 0, values[20]);
    const res = resampleUniform(values, tsMs, FS);
    expect(res.duplicates).toBeGreaterThanOrEqual(1);
    expect(res.values.length).toBeGreaterThan(30);
    expect(res.values.every((v) => Number.isFinite(v))).toBe(true);
  });

  it("returns an empty result for < 4 samples", () => {
    const res = resampleUniform([1, 2, 3], [0, 33, 66], FS);
    expect(res.values).toEqual([]);
  });
});