/**
 * Spectral estimation for heart-rate recovery. Pure (no DOM, no Date).
 *
 * Welch's averaged periodogram is the field-standard final HR estimator for
 * short (15–30 s) rPPG signals: it trades frequency resolution for a 3–6×
 * variance reduction over a plain FFT, which matters when the window holds
 * only a few cardiac cycles. Parabolic interpolation around the tallest
 * in-band peak gives sub-bin precision. Two quality indices gate acceptance:
 *   - snrSQI : HR-band peak power / total in-band power (Ernst 2020 — strongest
 *     single correlate of HR error; gate ≥ 0.15).
 *   - rdspSQI: tallest / 2nd-tallest in-band peak ratio (peak prominence; gate
 *     ≥ 2.0 — rejects broadband motion that has no single dominant peak).
 */

export function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

/** In-place radix-2 Cooley–Tukey FFT. `re`/`im` length must be a power of two. */
function fftRadix2(re: number[], im: number[]): void {
  const n = re.length;
  // Bit-reversal permutation.
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i];
      re[i] = re[j];
      re[j] = tr;
      const ti = im[i];
      im[i] = im[j];
      im[j] = ti;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      const half = len >> 1;
      for (let k = 0; k < half; k++) {
        const ur = re[i + k];
        const ui = im[i + k];
        const vr = re[i + k + half] * cr - im[i + k + half] * ci;
        const vi = re[i + k + half] * ci + im[i + k + half] * cr;
        re[i + k] = ur + vr;
        im[i + k] = ui + vi;
        re[i + k + half] = ur - vr;
        im[i + k + half] = ui - vi;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = ncr;
      }
    }
  }
}

export interface WelchResult {
  freqs: number[];
  psd: number[];
  sampleRate: number;
  nfft: number;
}

/**
 * Welch's method: Hann-windowed segments of `segSec` seconds, 50% overlap,
 * zero-padded to the next power of two ≥ segLen, |FFT|² averaged. Returns the
 * one-sided power spectrum (frequencies 0..fs/2). Scaling is proportional to
 * PSD; ratios (snrSqi/rdspSqi) are scale-invariant.
 */
export function welchPsd(
  signal: number[],
  sampleRate: number,
  segSec = 5,
  overlap = 0.5,
): WelchResult {
  const n = signal.length;
  if (n < 8 || sampleRate <= 0) return { freqs: [], psd: [], sampleRate, nfft: 0 };
  const segLen = Math.max(8, Math.round(sampleRate * segSec));
  if (segLen > n) {
    // Not enough signal for a full segment — use the whole trace as one window.
    return singleWindowPsd(signal, sampleRate, n);
  }
  const step = Math.max(1, Math.round(segLen * (1 - overlap)));
  const nfft = nextPow2(segLen);
  const hann = new Array<number>(segLen);
  for (let i = 0; i < segLen; i++) {
    hann[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (segLen - 1));
  }
  const half = nfft >> 1;
  const acc = new Array<number>(half + 1).fill(0);
  let segCount = 0;
  for (let start = 0; start + segLen <= n; start += step) {
    const re = new Array<number>(nfft).fill(0);
    const im = new Array<number>(nfft).fill(0);
    for (let i = 0; i < segLen; i++) re[i] = signal[start + i] * hann[i];
    fftRadix2(re, im);
    for (let k = 0; k <= half; k++) {
      // One-sided: double all but DC and Nyquist.
      const mag = re[k] * re[k] + im[k] * im[k];
      acc[k] += (k === 0 || k === half) ? mag : 2 * mag;
    }
    segCount++;
  }
  if (segCount === 0) return singleWindowPsd(signal, sampleRate, n);
  const freqs = new Array<number>(half + 1);
  const psd = new Array<number>(half + 1);
  for (let k = 0; k <= half; k++) {
    freqs[k] = (k * sampleRate) / nfft;
    psd[k] = acc[k] / segCount;
  }
  return { freqs, psd, sampleRate, nfft };
}

function singleWindowPsd(
  signal: number[],
  sampleRate: number,
  n: number,
): WelchResult {
  const nfft = nextPow2(Math.max(8, n));
  const re = new Array<number>(nfft).fill(0);
  const im = new Array<number>(nfft).fill(0);
  const hann = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    hann[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1));
    re[i] = signal[i] * hann[i];
  }
  fftRadix2(re, im);
  const half = nfft >> 1;
  const freqs = new Array<number>(half + 1);
  const psd = new Array<number>(half + 1);
  for (let k = 0; k <= half; k++) {
    const mag = re[k] * re[k] + im[k] * im[k];
    freqs[k] = (k * sampleRate) / nfft;
    psd[k] = (k === 0 || k === half) ? mag : 2 * mag;
  }
  return { freqs, psd, sampleRate, nfft };
}

export interface SpectralPeak {
  hz: number;
  power: number;
  /** Ratio of tallest to 2nd-tallest in-band peak (peak prominence). */
  prominence: number;
  bin: number;
}

/**
 * Find the tallest in-band peak with parabolic (sub-bin) interpolation. Also
 * returns the prominence vs the 2nd-tallest in-band local maximum. Returns
 * {hz:0} when the band contains no samples.
 */
export function spectralPeak(
  psd: number[],
  freqs: number[],
  minHz = 0.66,
  maxHz = 3.0,
): SpectralPeak {
  const n = psd.length;
  if (n < 3) return { hz: 0, power: 0, prominence: 0, bin: 0 };
  // Local maxima within [minHz, maxHz].
  const peaks: { bin: number; power: number }[] = [];
  for (let k = 1; k < n - 1; k++) {
    if (freqs[k] < minHz || freqs[k] > maxHz) continue;
    if (psd[k] > psd[k - 1] && psd[k] >= psd[k + 1]) {
      peaks.push({ bin: k, power: psd[k] });
    }
  }
  if (peaks.length === 0) {
    // No local maximum — fall back to the global in-band max bin.
    let bestBin = 0;
    let bestPow = -Infinity;
    for (let k = 0; k < n; k++) {
      if (freqs[k] < minHz || freqs[k] > maxHz) continue;
      if (psd[k] > bestPow) {
        bestPow = psd[k];
        bestBin = k;
      }
    }
    if (bestPow <= 0) return { hz: 0, power: 0, prominence: 0, bin: 0 };
    return {
      hz: freqs[bestBin],
      power: bestPow,
      prominence: 1,
      bin: bestBin,
    };
  }
  peaks.sort((a, b) => b.power - a.power);
  const top = peaks[0];
  const second = peaks.length > 1 ? peaks[1].power : 0;
  // Parabolic interpolation around the tallest peak.
  const k = top.bin;
  const y0 = psd[k - 1];
  const y1 = psd[k];
  const y2 = psd[k + 1];
  const denom = y0 - 2 * y1 + y2;
  let delta = 0;
  if (denom !== 0) {
    delta = (0.5 * (y0 - y2)) / denom;
    if (delta < -0.5) delta = -0.5;
    if (delta > 0.5) delta = 0.5;
  }
  const df = freqs[1] - freqs[0];
  const hz = freqs[k] + delta * df;
  const prominence = second > 0 ? top.power / second : Infinity;
  return { hz, power: top.power, prominence, bin: k };
}

/**
 * Frequency-domain SNR quality index: power at the HR peak ±1 bin plus its
 * 2nd harmonic, divided by total power in the search band. Ernst 2020 found
 * this the strongest single correlate of HR error (r = −0.52 to −0.55);
 * ≥ 0.15 (≈ −8.2 dB) → RMSE ~2.0 BPM. Returns 0 for an empty band.
 */
export function snrSqi(
  psd: number[],
  freqs: number[],
  peakHz: number,
  minHz = 0.66,
  maxHz = 3.0,
): number {
  const n = psd.length;
  if (n === 0 || peakHz <= 0) return 0;
  const df = freqs[1] - freqs[0];
  let total = 0;
  for (let k = 0; k < n; k++) {
    if (freqs[k] < minHz || freqs[k] > maxHz) continue;
    total += psd[k];
  }
  if (total <= 0) return 0;
  const peakBin = Math.round(peakHz / df);
  const harmBin = Math.round((2 * peakHz) / df);
  let signalPow = 0;
  for (let k = peakBin - 1; k <= peakBin + 1; k++) {
    if (k >= 0 && k < n) signalPow += psd[k];
  }
  for (let k = harmBin - 1; k <= harmBin + 1; k++) {
    if (k >= 0 && k < n && freqs[k] <= maxHz) signalPow += psd[k];
  }
  return Math.min(1, signalPow / total);
}

/**
 * Relative-difference-of-spectral-peaks: tallest / 2nd-tallest in-band peak.
 * A clean pulse has one dominant peak; broadband motion has many comparable
 * peaks. Gate ≥ 2.0 (peak must be at least twice the runner-up).
 */
export function rdspSqi(
  psd: number[],
  freqs: number[],
  minHz = 0.66,
  maxHz = 3.0,
): number {
  const n = psd.length;
  if (n < 3) return 0;
  const peaks: number[] = [];
  for (let k = 1; k < n - 1; k++) {
    if (freqs[k] < minHz || freqs[k] > maxHz) continue;
    if (psd[k] > psd[k - 1] && psd[k] >= psd[k + 1]) peaks.push(psd[k]);
  }
  if (peaks.length === 0) return 0;
  peaks.sort((a, b) => b - a);
  if (peaks.length === 1) return Infinity;
  return peaks[1] > 0 ? peaks[0] / peaks[1] : Infinity;
}