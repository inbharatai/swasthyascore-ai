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
  // `center` is the geometric-mean cutoff as a FRACTION OF NYQUIST (0..1). The
  // RBJ biquad cookbook formulas need w0 in RADIANS/sample = 2*pi*f0/Fs. Since
  // f0 = center * (Fs/2), w0 = 2*pi*center*(Fs/2)/Fs = pi*center. The missing
  // pi factor here previously shifted the filter peak to ~1/pi of the target.
  const center = Math.sqrt(wLow * wHigh);
  const bandwidth = wHigh - wLow;
  const Q = center / bandwidth;

  const coefficients = computeBandpassCoefficients(Math.PI * center, Q);
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
 *
 * `minHz`/`maxHz` bound the search window so the same routine serves heart
 * rate (default 0.5–3.2 Hz) and respiratory rate (0.1–0.5 Hz). Without bounds
 * the RR autocorrelation peak (period 4–10s) falls outside the HR lag window
 * and is never found.
 *
 * Accuracy measures (so the live camera scan reports the true heart rate, not
 * a harmonic):
 *   - The unnormalized autocorrelation's (N-lag) overlap decay biases toward
 *     shorter lags, which naturally favors the fundamental period over its
 *     harmonics (2T, 3T) for the non-sinusoidal PPG waveform.
 *   - We then pick the FIRST significant local maximum scanning upward (the
 *     fundamental), not the global max — this is the standard fix for the rPPG
 *     "halving" error where a harmonic at 2T outscores the true period.
 *   - Parabolic interpolation around the peak gives sub-sample lag precision,
 *     cutting BPM quantization from ~3 BPM at 30 fps to under 1 BPM.
 *   - An energy gate rejects flat/noisy windows (no fabricated frequency).
 */
export function dominantFrequencyHz(
  signal: number[],
  sampleRate: number,
  minHz = 0.5,
  maxHz = 3.2,
): number {
  if (signal.length < 8 || sampleRate <= 0 || maxHz <= 0 || minHz <= 0) return 0;

  const normalized = normalize(signal);
  const maxLag = Math.min(
    normalized.length - 1,
    Math.floor(sampleRate / minHz), // longest period = lowest frequency
  );
  const minLag = Math.max(1, Math.floor(sampleRate / maxHz)); // shortest period

  if (maxLag < minLag) return 0;

  // Unnormalized autocorrelation over the bounded lag window.
  const autocorr = new Array<number>(maxLag + 1).fill(0);
  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0;
    for (let i = 0; i + lag < normalized.length; i++) {
      sum += normalized[i] * normalized[i + lag];
    }
    autocorr[lag] = sum;
  }

  let globalMaxLag = minLag;
  let globalMax = autocorr[minLag];
  for (let lag = minLag + 1; lag <= maxLag; lag++) {
    if (autocorr[lag] > globalMax) {
      globalMax = autocorr[lag];
      globalMaxLag = lag;
    }
  }

  // Energy gate: a normalized signal has lag-0 energy = N. A real periodic
  // component clears a meaningful fraction of that; pure noise does not, so we
  // return 0 instead of inventing a frequency from a noise spike.
  const energy = normalized.length;
  if (globalMax <= 0 || globalMax < 0.2 * energy) return 0;

  // First significant local maximum scanning upward = the fundamental period.
  // A peak must clear 85% of the global max so a low-amplitude early ripple
  // cannot masquerade as the heart rate.
  const threshold = 0.85 * globalMax;
  let bestLag = 0;
  for (let lag = minLag; lag <= maxLag; lag++) {
    const prev = lag > minLag ? autocorr[lag - 1] : -Infinity;
    const next = lag < maxLag ? autocorr[lag + 1] : -Infinity;
    if (autocorr[lag] >= prev && autocorr[lag] > next && autocorr[lag] >= threshold) {
      bestLag = lag;
      break;
    }
  }
  if (bestLag === 0) bestLag = globalMaxLag; // no clean peak — fall back to global max

  const refinedLag = parabolicRefine(autocorr, bestLag, minLag, maxLag);
  if (refinedLag <= 0) return 0;
  return sampleRate / refinedLag;
}

/** Parabolic interpolation around an integer peak lag for sub-sample precision.
 * Fits y = a*(lag)^2 + b*(lag) + c through (lag-1, lag, lag+1) and returns the
 * vertex. Offset is in [-0.5, +0.5]; falls back to the integer lag at edges or
 * when the parabola is degenerate (flat). */
function parabolicRefine(
  autocorr: number[],
  lag: number,
  minLag: number,
  maxLag: number,
): number {
  if (lag <= minLag || lag >= maxLag) return lag;
  const y0 = autocorr[lag - 1];
  const y1 = autocorr[lag];
  const y2 = autocorr[lag + 1];
  const denom = y0 - 2 * y1 + y2;
  if (denom === 0) return lag;
  const delta = (0.5 * (y0 - y2)) / denom;
  return lag + delta;
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