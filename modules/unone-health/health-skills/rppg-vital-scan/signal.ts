/**
 * Pure rPPG signal-processing primitives. No DOM, no browser APIs — so the
 * real engine and the unit tests share the exact same math.
 *
 * Pipeline (see health-skills/rppg-vital-scan/engine.ts):
 *   per-frame green mean -> detrend -> bandpass -> estimate BPM via FFT/autocorr
 *
 * NOTE: This is an EXPERIMENTAL research-grade pipeline. It is NOT clinically
 * validated and must not be presented as a medical measurement.
 */

/** Remove the slow lighting drift by subtracting a moving average. */
export function detrend(signal: number[], windowSize = 15): number[] {
  if (signal.length === 0) return [];
  const out = new Array<number>(signal.length).fill(0);
  const half = Math.floor(windowSize / 2);
  for (let i = 0; i < signal.length; i++) {
    let sum = 0;
    let count = 0;
    for (let j = -half; j <= half; j++) {
      const k = i + j;
      if (k >= 0 && k < signal.length) {
        sum += signal[k];
        count++;
      }
    }
    out[i] = signal[i] - sum / count;
  }
  return out;
}

/** Normalise to zero mean / unit-ish variance. */
export function normalize(signal: number[]): number[] {
  const mean = signal.reduce((a, b) => a + b, 0) / Math.max(1, signal.length);
  const centered = signal.map((v) => v - mean);
  const variance =
    centered.reduce((a, b) => a + b * b, 0) / Math.max(1, centered.length);
  const std = Math.sqrt(variance) || 1;
  return centered.map((v) => v / std);
}

/**
 * Second-order Butterworth bandpass (biquad) via the cascade-of-biquads
 * Direct-Form-II transposed structure. Coefficients computed for the given
 * low/high cutoffs at `sampleRate`. Returns the filtered signal.
 */
export function bandpass(
  signal: number[],
  sampleRate: number,
  lowHz: number,
  highHz: number,
): number[] {
  if (signal.length === 0 || sampleRate <= 0) return signal;

  const nyquist = sampleRate / 2;
  const wLow = lowHz / nyquist;
  const wHigh = highHz / nyquist;
  if (wLow <= 0 || wHigh >= 1 || wLow >= wHigh) return signal;

  // Pre-warp + analog prototype (Butterworth order 2 bandpass, Q ~ center/bw).
  const center = Math.sqrt(wLow * wHigh);
  const bandwidth = wHigh - wLow;
  const Q = center / bandwidth;

  const coefficients = computeBandpassCoefficients(center, Q);
  return applyBiquad(signal, coefficients);
}

interface BiquadCoefficients {
  b0: number;
  b1: number;
  b2: number;
  a1: number;
  a2: number;
}

function computeBandpassCoefficients(
  w0: number,
  Q: number,
): BiquadCoefficients {
  const alpha = Math.sin(w0) / (2 * Q);
  const cosw0 = Math.cos(w0);

  const b0 = alpha;
  const b1 = 0;
  const b2 = -alpha;
  const a0 = 1 + alpha;
  const a1 = -2 * cosw0;
  const a2 = 1 - alpha;

  return {
    b0: b0 / a0,
    b1: b1 / a0,
    b2: b2 / a0,
    a1: a1 / a0,
    a2: a2 / a0,
  };
}

function applyBiquad(
  signal: number[],
  coeff: BiquadCoefficients,
): number[] {
  const out = new Array<number>(signal.length).fill(0);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < signal.length; i++) {
    const x0 = signal[i];
    const y0 =
      coeff.b0 * x0 +
      coeff.b1 * x1 +
      coeff.b2 * x2 -
      coeff.a1 * y1 -
      coeff.a2 * y2;
    out[i] = y0;
    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = y0;
  }
  return out;
}

/**
 * Estimate the dominant frequency via autocorrelation. Robust for short,
 * noisy signals where an FFT bin resolution is coarse. Returns Hz (0 if no
 * clear periodicity).
 */
export function dominantFrequencyHz(
  signal: number[],
  sampleRate: number,
): number {
  if (signal.length < 8 || sampleRate <= 0) return 0;

  const normalized = normalize(signal);
  const maxLag = Math.min(
    normalized.length - 1,
    Math.floor(sampleRate / 0.5), // up to ~0.5 Hz lag window
  );
  const minLag = Math.max(1, Math.floor(sampleRate / 3.2)); // 3.2 Hz cap

  let bestLag = 0;
  let bestScore = -Infinity;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0;
    for (let i = 0; i + lag < normalized.length; i++) {
      sum += normalized[i] * normalized[i + lag];
    }
    if (sum > bestScore) {
      bestScore = sum;
      bestLag = lag;
    }
  }

  if (bestLag <= 0) return 0;
  return sampleRate / bestLag;
}

/** Convert Hz -> BPM. */
export function hzToBpm(hz: number): number {
  return Math.round(hz * 60);
}

/** Simple signal-quality score (0..1): variance of the band-passed signal. */
export function signalQualityScore(filtered: number[]): number {
  if (filtered.length === 0) return 0;
  const mean = filtered.reduce((a, b) => a + b, 0) / filtered.length;
  const variance =
    filtered.reduce((a, b) => a + (b - mean) * (b - mean), 0) / filtered.length;
  const std = Math.sqrt(variance);
  // Empirical mapping: a healthy PPG-like AC component lands ~0.05-0.3 here.
  return Math.max(0, Math.min(1, std * 4));
}