import { describe, expect, it } from "vitest";
import {
  welchPsd,
  spectralPeak,
  snrSqi,
  rdspSqi,
} from "@/modules/unone-health/health-skills/rppg-vital-scan/spectral";

const FS = 30;

function sine(hz: number, seconds: number, amp = 1, dc = 0): number[] {
  const out: number[] = [];
  for (let i = 0; i < FS * seconds; i++) {
    out.push(dc + Math.sin((2 * Math.PI * hz * i) / FS) * amp);
  }
  return out;
}

describe("welchPsd + spectralPeak", () => {
  it("locates a clean 1.2 Hz sine at 72 BPM ±1", () => {
    const w = welchPsd(sine(1.2, 20, 1), FS, 5, 0.5);
    const hz = spectralPeak(w.psd, w.freqs, 0.66, 3.0).hz;
    expect(hz * 60).toBeGreaterThan(70);
    expect(hz * 60).toBeLessThan(74);
  });

  it("locks the fundamental of a 1.2 Hz pulse train (no halving to 0.6 Hz)", () => {
    // Sharp pulse train: a narrow peak every 1/1.2 s. A naive first-peak
    // autocorrelation can lock the 0.6 Hz subharmonic; Welch's averaged
    // periodogram locks the 1.2 Hz fundamental.
    const n = FS * 20;
    const sig: number[] = [];
    for (let i = 0; i < n; i++) {
      const phase = (i / FS) * 1.2;
      const frac = phase - Math.floor(phase); // 0..1 within each cycle
      // Narrow Gaussian pulse (duty cycle ~8%).
      sig.push(Math.exp(-Math.pow((frac - 0.5) / 0.04, 2)));
    }
    const w = welchPsd(sig, FS, 5, 0.5);
    const hz = spectralPeak(w.psd, w.freqs, 0.66, 3.0).hz;
    expect(hz).toBeGreaterThan(1.1);
    expect(hz).toBeLessThan(1.3);
  });
});

describe("snrSqi + rdspSqi gates", () => {
  it("snrSqi is high on a clean sine and LOWER on broadband noise", () => {
    // snrSqi sums the peak ±1 bin + 2nd harmonic ±1 bin, so even a uniformly
    // spread spectrum has a floor (~6 bins / ~20 in-band bins ≈ 0.3); the gate
    // that actually rejects noise is rdspSqi (peak prominence), tested below.
    // The honest claim here: clean signal has clearly higher snrSqi than noise.
    const clean = sine(1.2, 20, 1);
    const cw = welchPsd(clean, FS, 5, 0.5);
    const cpeak = spectralPeak(cw.psd, cw.freqs, 0.66, 3.0);
    const cleanSnr = snrSqi(cw.psd, cw.freqs, cpeak.hz, 0.66, 3.0);
    expect(cleanSnr).toBeGreaterThan(0.15);

    // Broadband noise (many in-band sinusoids, no dominant peak).
    const noise: number[] = [];
    const freqs = [0.7, 0.9, 1.1, 1.3, 1.5, 1.7, 1.9, 2.1, 2.3, 2.5, 2.7, 2.9];
    for (let i = 0; i < FS * 20; i++) {
      const t = i / FS;
      let v = 0;
      for (let k = 0; k < freqs.length; k++) {
        v += Math.sin(2 * Math.PI * freqs[k] * t + k * 0.7);
      }
      noise.push(v);
    }
    const nw = welchPsd(noise, FS, 5, 0.5);
    const npeak = spectralPeak(nw.psd, nw.freqs, 0.66, 3.0);
    const noiseSnr = snrSqi(nw.psd, nw.freqs, npeak.hz, 0.66, 3.0);
    expect(noiseSnr).toBeLessThan(cleanSnr);
  });

  it("rdspSqi ≥ 2.0 on a clean sine (one dominant peak), < 2.0 on noise", () => {
    const cw = welchPsd(sine(1.2, 20, 1), FS, 5, 0.5);
    expect(rdspSqi(cw.psd, cw.freqs, 0.66, 3.0)).toBeGreaterThan(2.0);

    const noise: number[] = [];
    const freqs = [0.7, 0.9, 1.1, 1.3, 1.5, 1.7, 1.9, 2.1, 2.3, 2.5, 2.7, 2.9];
    for (let i = 0; i < FS * 20; i++) {
      const t = i / FS;
      let v = 0;
      for (let k = 0; k < freqs.length; k++) {
        v += Math.sin(2 * Math.PI * freqs[k] * t + k * 0.7);
      }
      noise.push(v);
    }
    const nw = welchPsd(noise, FS, 5, 0.5);
    expect(rdspSqi(nw.psd, nw.freqs, 0.66, 3.0)).toBeLessThan(2.0);
  });
});