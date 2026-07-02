import { describe, expect, it } from "vitest";
import { spaDetrend } from "@/modules/unone-health/health-skills/rppg-vital-scan/signal";
import { welchPsd, spectralPeak } from "@/modules/unone-health/health-skills/rppg-vital-scan/spectral";

const FS = 30;

describe("spaDetrend (Tarvainen smoothness priors)", () => {
  it("removes DC + linear drift while preserving a 1.2 Hz pulse", () => {
    const n = FS * 10;
    const signal: number[] = [];
    for (let i = 0; i < n; i++) {
      const t = i / FS;
      // DC offset 50 + linear drift 0.2*i + 1.2 Hz pulse (amp 4).
      signal.push(50 + 0.2 * i + Math.sin(2 * Math.PI * 1.2 * t) * 4);
    }
    const detrended = spaDetrend(signal, 50);
    // DC + drift removed → near-zero mean.
    const mean = detrended.reduce((a, b) => a + b, 0) / detrended.length;
    expect(Math.abs(mean)).toBeLessThan(0.5);
    // 1.2 Hz pulse preserved → still the dominant in-band peak.
    const w = welchPsd(detrended, FS, 5, 0.5);
    const hz = spectralPeak(w.psd, w.freqs, 0.66, 3.0).hz;
    expect(hz).toBeGreaterThan(1.1);
    expect(hz).toBeLessThan(1.3);
  });

  it("preserves the 0.75 Hz (45 BPM) lower HR edge (attenuation < 1 dB)", () => {
    // A moving-average detrend with window 15 @ 30 fps (0.5 s) has its first
    // null at 2 Hz and noticeably attenuates 0.75 Hz. SPA's cutoff is
    // ~fs/(2πλ) ≈ 0.1 Hz, so 0.75 Hz must pass almost untouched.
    const n = FS * 12;
    const hz = 0.75;
    const signal: number[] = [];
    for (let i = 0; i < n; i++) {
      const t = i / FS;
      signal.push(100 + Math.sin(2 * Math.PI * hz * t) * 4);
    }
    const detrended = spaDetrend(signal, 50);
    // AC amplitude retained: peak-to-peak of detrended ≈ input AC amplitude.
    const ac = Math.max(...detrended) - Math.min(...detrended);
    expect(ac).toBeGreaterThan(7.5); // input pk-pk = 8; allow slight edge loss
  });

  it("falls back to mean removal for very short signals without throwing", () => {
    const detrended = spaDetrend([1, 2, 3], 50);
    expect(detrended.length).toBe(3);
    // mean-removed → sum ~0
    const sum = detrended.reduce((a, b) => a + b, 0);
    expect(Math.abs(sum)).toBeLessThan(1e-6);
  });

  it("handles a constant (flat) signal → all zeros", () => {
    const detrended = spaDetrend(new Array(100).fill(42), 50);
    expect(detrended.every((v) => Math.abs(v) < 1e-6)).toBe(true);
  });
});