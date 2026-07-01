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
});

function variance(signal: number[]): number {
  if (signal.length === 0) return 0;
  const mean = signal.reduce((a, b) => a + b, 0) / signal.length;
  return (
    signal.reduce((a, b) => a + (b - mean) * (b - mean), 0) / signal.length
  );
}