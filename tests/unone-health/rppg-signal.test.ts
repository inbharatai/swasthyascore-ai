import { describe, expect, it } from "vitest";
import {
  bandpass,
  detrend,
  dominantFrequencyHz,
  hzToBpm,
} from "@/modules/unone-health/health-skills/rppg-vital-scan/signal";

const SAMPLE_RATE = 30;

/** Generate `n` samples of a sine at `hz` (with a small DC + drift). */
function sine(hz: number, n: number, amp = 1): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    out.push(
      128 + Math.sin((2 * Math.PI * hz * i) / SAMPLE_RATE) * amp +
        Math.sin(i * 0.05) * 0.2,
    );
  }
  return out;
}

describe("bandpass", () => {
  it("preserves an in-band heart-rate signal (1.5 Hz) and attenuates an out-of-band one", () => {
    // 1.5 Hz = 90 BPM, inside the 0.75–3.0 Hz HR band.
    const inBand = bandpass(detrend(sine(1.5, 300, 1)), SAMPLE_RATE, 0.75, 3.0);
    const inBandPower = variance(inBand);

    // 0.2 Hz = 12 BPM, well outside the HR band (it is an RR frequency).
    const outBand = bandpass(detrend(sine(0.2, 300, 1)), SAMPLE_RATE, 0.75, 3.0);
    const outBandPower = variance(outBand);

    // The in-band signal must retain most of its energy; the out-of-band tone
    // must be heavily attenuated. This is exactly what the previous (missing
    // pi-factor) bug broke — the filter peaked at ~0.48 Hz instead of 1.5 Hz.
    expect(inBandPower).toBeGreaterThan(outBandPower * 20);
  });
});

describe("dominantFrequencyHz", () => {
  it("recovers a 1.5 Hz (90 BPM) heart-rate signal in the default HR window", () => {
    const hz = dominantFrequencyHz(sine(1.5, 300, 1), SAMPLE_RATE);
    expect(hz).toBeCloseTo(1.5, 1);
    expect(hzToBpm(hz)).toBe(90);
  });

  it("recovers a 0.2 Hz (12 RPM) respiratory signal ONLY when given the RR window", () => {
    const rrSignal = sine(0.2, 600, 1);
    // Default (HR) window 0.5–3.2 Hz cannot see a 0.2 Hz signal — it must NOT
    // report ~0.2 Hz. Previously the hardcoded HR lag window meant RR was always
    // wrong/null because the RR autocorrelation peak lay outside the search range.
    const defaultHz = dominantFrequencyHz(rrSignal, SAMPLE_RATE);
    expect(defaultHz).toBeGreaterThanOrEqual(0.5);

    // With the RR window 0.1–0.5 Hz, the 0.2 Hz peak is found correctly.
    const rrHz = dominantFrequencyHz(rrSignal, SAMPLE_RATE, 0.1, 0.5);
    expect(rrHz).toBeCloseTo(0.2, 1);
    expect(Math.round(rrHz * 60)).toBe(12);
  });

  it("reports the fundamental, not a harmonic, for a pulse-train PPG waveform", () => {
    // A non-sinusoidal PPG (sharp systolic upstroke) has autocorrelation peaks
    // at every multiple of the period. The estimator must return the fundamental
    // (1.5 Hz / 90 BPM), not half (0.75 Hz — the classic halving error) or double.
    const period = 20; // 30 fps / 20 = 1.5 Hz
    const n = 600;
    const pulses: number[] = [];
    for (let i = 0; i < n; i++) {
      const phase = i % period;
      const d = Math.min(phase, period - phase); // distance to nearest pulse
      pulses.push(128 + Math.exp(-(d * d) / 2) * 3);
    }
    const hz = dominantFrequencyHz(pulses, SAMPLE_RATE);
    expect(hz).toBeCloseTo(1.5, 1);
    expect(hzToBpm(hz)).toBe(90);
  });

  it("uses sub-sample (parabolic) precision so off-grid heart rates are accurate", () => {
    // 1.7 Hz at 30 fps -> period 17.65 samples (not an integer lag). Without
    // parabolic interpolation the nearest integer lag (17) gives 30/17 = 1.765
    // Hz (off by ~0.065 Hz / ~4 BPM). Parabolic refinement must land within
    // 0.05 Hz of the true 1.7 Hz.
    const hz = dominantFrequencyHz(sine(1.7, 600, 1), SAMPLE_RATE);
    expect(Math.abs(hz - 1.7)).toBeLessThan(0.05);
    expect(hzToBpm(hz)).toBe(102);
  });

  it("returns 0 for a pulse-less / noise window (no fabricated frequency)", () => {
    // Deterministic white-ish noise via an LCG (no Math.random flakiness). The
    // energy gate must reject it — a noisy window must never invent a heart rate.
    const noise: number[] = [];
    let state = 1234567;
    for (let i = 0; i < 600; i++) {
      state = (state * 1103515245 + 12345) & 0x7fffffff;
      noise.push((state / 0x7fffffff - 0.5) * 100);
    }
    expect(dominantFrequencyHz(noise, SAMPLE_RATE)).toBe(0);

    // A flat line is also pulse-less.
    expect(dominantFrequencyHz(new Array(300).fill(128), SAMPLE_RATE)).toBe(0);
  });
});

describe("dominantFrequencyHz — minPeakEnergyRatio (RR gate)", () => {
  it("accepts a clean respiratory signal (0.25 Hz / 15 rpm) under the stricter 0.35 gate", () => {
    // 20s at 30fps. A real 0.25 Hz breath signal has a strong autocorrelation
    // peak that clears even the strict gate used by estimateRespiratoryRate.
    const hz = dominantFrequencyHz(sine(0.25, 600, 1), SAMPLE_RATE, 0.1, 0.5, 0.35);
    expect(hz).toBeCloseTo(0.25, 1);
    expect(Math.round(hz * 60)).toBe(15);
  });

  it("rejects noise in the RR band under the 0.35 gate (no fabricated breath rate)", () => {
    const noise: number[] = [];
    let state = 7654321;
    for (let i = 0; i < 600; i++) {
      state = (state * 1103515245 + 12345) & 0x7fffffff;
      noise.push((state / 0x7fffffff - 0.5) * 50);
    }
    expect(dominantFrequencyHz(noise, SAMPLE_RATE, 0.1, 0.5, 0.35)).toBe(0);
  });

  it("honours the ratio: a gate of 0.99 rejects even a clean tone", () => {
    // A finite window's autocorrelation peak is always below 1.0 * energy, so
    // an absurdly strict gate must reject everything. This proves the param
    // actually gates acceptance (and that the default 0.2 is what lets a clean
    // tone through elsewhere).
    const clean = sine(1.5, 300, 1);
    expect(dominantFrequencyHz(clean, SAMPLE_RATE, 0.5, 3.2, 0.99)).toBe(0);
  });
});

function variance(signal: number[]): number {
  if (signal.length === 0) return 0;
  const mean = signal.reduce((a, b) => a + b, 0) / signal.length;
  return (
    signal.reduce((a, b) => a + (b - mean) * (b - mean), 0) / signal.length
  );
}