import { describe, expect, it } from "vitest";
import { posSignal } from "@/modules/unone-health/health-skills/rppg-vital-scan/pos";
import { welchPsd, spectralPeak } from "@/modules/unone-health/health-skills/rppg-vital-scan/spectral";

const FS = 30;

/** RGB at a target HR with realistic per-channel pulse amplitudes. */
function rgbAt(hz: number, seconds: number, ampR = 3, ampG = 5, ampB = 2) {
  const n = FS * seconds;
  const r: number[] = [];
  const g: number[] = [];
  const b: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / FS;
    const p = Math.sin(2 * Math.PI * hz * t);
    r.push(130 + p * ampR);
    g.push(128 + p * ampG);
    b.push(126 + p * ampB);
  }
  return { r, g, b };
}

function peakHz(signal: number[]) {
  const w = welchPsd(signal, FS, 5, 0.5);
  return spectralPeak(w.psd, w.freqs, 0.66, 3.0).hz;
}

describe("POS multi-channel extraction", () => {
  it("recovers the true HR (72 BPM) from synthetic RGB", () => {
    const { r, g, b } = rgbAt(1.2, 20);
    const pulse = posSignal(r, g, b, FS);
    expect(pulse.length).toBeGreaterThan(0);
    const hz = peakHz(pulse);
    expect(hz).toBeGreaterThan(1.1);
    expect(hz).toBeLessThan(1.3);
  });

  it("is invariant to a large in-band common-mode (ambient flicker) where green-only drifts", () => {
    // Add the SAME 1.5 Hz sinusoid (ambient-light flicker, inside the HR band)
    // to ALL three channels at an amplitude 2-3x the pulse. POS projects the
    // plane orthogonal to skin tone, so the common-mode cancels in S1=G-B and
    // S2=-2R+G+B and the 1.2 Hz pulse remains the tallest peak. A green-only
    // estimator would lock the larger 1.5 Hz flicker.
    const { r, g, b } = rgbAt(1.2, 20);
    const cm = (t: number) => Math.sin(2 * Math.PI * 1.5 * t) * 12;
    const R = r.map((v, i) => v + cm(i / FS));
    const G = g.map((v, i) => v + cm(i / FS));
    const B = b.map((v, i) => v + cm(i / FS));
    const pulse = posSignal(R, G, B, FS);
    const hz = peakHz(pulse);
    // POS must still lock 1.2 Hz, NOT the 1.5 Hz common-mode.
    expect(hz).toBeGreaterThan(1.1);
    expect(hz).toBeLessThan(1.3);

    // Sanity check the contrast: the raw green channel's tallest in-band peak
    // is dominated by the 1.5 Hz flicker (this is what POS fixes).
    const greenPeak = peakHz(G);
    expect(Math.abs(greenPeak - 1.5)).toBeLessThan(0.15);
  });

  it("returns a non-empty trace even for a short capture (single-window path)", () => {
    const { r, g, b } = rgbAt(1.2, 1); // 1 s < 1.6 s window -> single-window branch
    const pulse = posSignal(r, g, b, FS);
    expect(pulse.length).toBe(FS);
  });

  it("produces a degenerate (zero) trace when R=G=B (no chrominance)", () => {
    const n = FS * 10;
    const flat = new Array(n).fill(128);
    const pulse = posSignal(flat, flat, flat, FS);
    // All zeros — POS has no chrominance to project (the window's S2 has zero
    // variance, so the window is skipped). The HR pipeline returns null for a
    // flat capture separately (see heart-rate.test.ts); this test only asserts
    // the trace is degenerate, not that a downstream gate fired here.
    expect(pulse.every((v) => Math.abs(v) < 1e-9)).toBe(true);
  });
});