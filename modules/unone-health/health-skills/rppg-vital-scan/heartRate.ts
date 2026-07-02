/**
 * Pure heart-rate orchestrator. Turns per-frame RGB means (+ timestamps +
 * per-frame quality) into a trustworthy BPM, or null when the capture is not
 * trustworthy. No DOM, no `Date.now` — fully unit-testable with synthetic RGB.
 *
 * Pipeline (the literature SOTA for per-frame-mean rPPG, ~4 BPM MAE on
 * UBFC-RPPG vs ~20 BPM for plain green-average):
 *   1. Mask bad frames (motion / lighting) and drop duplicates.
 *   2. Resample to a uniform timebase (cubic Hermite) — the autocorrelation/FFT
 *      assume uniform sampling; rAF jitter + duplicate frames otherwise corrupt
 *      the lag→Hz mapping.
 *   3. Extract the pulse signal: POS multi-channel (face) or red channel (finger).
 *   4. SPA detrend (preserves the 0.7–2.5 Hz HR band) + zero-phase bandpass
 *      (4th-order effective, no phase lag) + warmup trim.
 *   5. Welch PSD peak reconciled with autocorrelation (guards halving/doubling).
 *   6. Gate on snrSQI (≥0.15) + rdspSQI (≥2.0) + per-window stability.
 *
 * EXPERIMENTAL — not clinically validated.
 */

import { dominantFrequencyHz } from "./signal";
import { spaDetrend, bandpassZeroPhase } from "./signal";
import { posSignal } from "./pos";
import { resampleUniform, detectDropsAndDuplicates } from "./resample";
import { welchPsd, spectralPeak, snrSqi, rdspSqi } from "./spectral";

export type HeartRateMode = "front_face" | "rear_finger";

export interface HeartRateInput {
  /** Per-frame red mean (for finger mode this is the signal; for face it feeds POS). */
  r: number[];
  /** Per-frame green mean. Face mode feeds POS; ignored for finger. */
  g: number[];
  /** Per-frame blue mean. Face mode feeds POS; ignored for finger. */
  b: number[];
  /** Per-frame capture timestamps in ms (monotonic, e.g. performance.now()). */
  timestampsMs: number[];
  /** Per-frame motion quality (0..1). */
  motion: number[];
  /** Per-frame lighting quality (0..1). */
  lighting: number[];
  /** Per-frame face/ROI stability (0..1). */
  stability: number[];
  mode: HeartRateMode;
  /** Optional prior validated BPM (from a previous scan) for harmonic reconciliation. */
  priorBpm?: number | null;
}

export interface HeartRateEstimate {
  bpm: number | null;
  /** Frequency-domain SNR (0..1). */
  snr: number;
  /** Peak prominence (tallest/2nd-tallest). */
  prominence: number;
  /** Windows whose autocorr agreed with the final estimate within 15 BPM. */
  acceptedWindows: number;
  totalWindows: number;
  /** Detected duplicate frames in the raw capture. */
  duplicates: number;
  /** Detected dropped frames in the raw capture. */
  drops: number;
}

const EMPTY: HeartRateEstimate = {
  bpm: null,
  snr: 0,
  prominence: 0,
  acceptedWindows: 0,
  totalWindows: 0,
  duplicates: 0,
  drops: 0,
};

/** A frame is kept for HR estimation only when its quality is good enough that
 * its channel means are not dominated by motion or lighting artefact. */
function frameKept(
  mode: HeartRateMode,
  motion: number,
  lighting: number,
  stability: number,
): boolean {
  if (lighting < 0.4) return false;
  if (mode === "front_face") return stability >= 0.5 && motion >= 0.4;
  return stability >= 0.3; // finger: contact stability; motion is contact delta
}

/** Reconcile a Welch peak with an autocorrelation peak, guarding halving/doubling. */
function reconcile(
  welchHz: number,
  autoHz: number,
): { hz: number; agreed: boolean } {
  const welchBpm = welchHz > 0 ? welchHz * 60 : 0;
  const autoBpm = autoHz > 0 ? autoHz * 60 : 0;
  if (welchHz <= 0 && autoHz <= 0) return { hz: 0, agreed: false };
  if (welchHz <= 0) return { hz: autoHz, agreed: false };
  if (autoHz <= 0) return { hz: welchHz, agreed: false };
  if (Math.abs(welchBpm - autoBpm) <= 10) return { hz: welchHz, agreed: true }; // agree → fine Welch
  // Welch locked the 2nd harmonic of the true fundamental (autocorr guards halving):
  if (Math.abs(welchBpm - 2 * autoBpm) <= 8) return { hz: autoHz, agreed: false };
  // Autocorr locked the harmonic (rare, since first-significant prefers fundamental):
  if (Math.abs(autoBpm - 2 * welchBpm) <= 8) return { hz: welchHz, agreed: false };
  // Otherwise disagree uncleanly — prefer autocorr's fundamental (robust to halving).
  return { hz: autoHz, agreed: false };
}

export function estimateHeartRateFromFrames(
  input: HeartRateInput,
): HeartRateEstimate {
  const { r, g, b, timestampsMs, motion, lighting, stability, mode, priorBpm } = input;
  const n = Math.min(r.length, timestampsMs.length, motion.length, lighting.length, stability.length);
  if (n < 30) return { ...EMPTY }; // < ~1 s of data is not enough
  if ((mode === "front_face") && (g.length < n || b.length < n)) {
    return { ...EMPTY };
  }

  const dupGap = detectDropsAndDuplicates(timestampsMs.slice(0, n));

  // (1) Mask bad frames → kept indices. If too few good frames, bail honestly.
  const keptIdx: number[] = [];
  for (let i = 0; i < n; i++) {
    if (frameKept(mode, motion[i], lighting[i], stability[i])) keptIdx.push(i);
  }
  if (keptIdx.length < 30) return { ...EMPTY, duplicates: dupGap.duplicates, drops: dupGap.drops };

  const kr = keptIdx.map((i) => r[i]);
  const kg = keptIdx.map((i) => g[i] ?? 0);
  const kb = keptIdx.map((i) => b[i] ?? 0);
  const kts = keptIdx.map((i) => timestampsMs[i]);

  // (2) Resample onto a uniform grid at the achieved cadence (capped 20–60 Hz).
  const median = dupGap.medianPeriodMs || kts[kts.length - 1] - kts[0] >= 0
    ? (kts[kts.length - 1] - kts[0]) / Math.max(1, kts.length - 1)
    : 33.33;
  let targetHz = Math.round(1000 / Math.max(1, median));
  if (targetHz < 20) targetHz = 20;
  if (targetHz > 60) targetHz = 60;

  const rr = resampleUniform(kr, kts, targetHz);
  if (rr.values.length < targetHz * 8) {
    return { ...EMPTY, duplicates: dupGap.duplicates, drops: dupGap.drops };
  }
  const fs = rr.sampleRate;

  let rg: number[];
  let bg: number[];
  if (mode === "front_face") {
    rg = resampleUniform(kg, kts, targetHz).values;
    bg = resampleUniform(kb, kts, targetHz).values;
    if (rg.length < fs * 8 || bg.length < fs * 8) {
      return { ...EMPTY, duplicates: dupGap.duplicates, drops: dupGap.drops };
    }
  } else {
    rg = [];
    bg = [];
  }

  // (3) Pulse signal: POS (face) or red channel (finger).
  const pulse = mode === "front_face" ? posSignal(rr.values, rg, bg, fs) : rr.values;
  if (pulse.length < fs * 8) return { ...EMPTY, duplicates: dupGap.duplicates, drops: dupGap.drops };

  // (4) SPA detrend (preserves HR band) + zero-phase bandpass + warmup trim.
  const detrended = spaDetrend(pulse, 50);
  const filtered = bandpassZeroPhase(detrended, fs, 0.7, 2.5);
  const warmup = Math.floor(fs * 1.5);
  const sig = warmup > 0 && warmup < filtered.length ? filtered.slice(warmup) : filtered;
  if (sig.length < fs * 6) return { ...EMPTY, duplicates: dupGap.duplicates, drops: dupGap.drops };

  // (5) Full-signal Welch + autocorrelation reconciliation.
  const welch = welchPsd(sig, fs, 5, 0.5);
  const peak = spectralPeak(welch.psd, welch.freqs, 0.66, 3.0);
  const autoHz = dominantFrequencyHz(sig, fs, 0.66, 3.0, 0.2);
  const rec = reconcile(peak.hz, autoHz);
  if (rec.hz <= 0) return { ...EMPTY, duplicates: dupGap.duplicates, drops: dupGap.drops };

  let bpm = Math.round(rec.hz * 60);
  const snr = snrSqi(welch.psd, welch.freqs, rec.hz, 0.66, 3.0);
  const prom = rdspSqi(welch.psd, welch.freqs, 0.66, 3.0);

  // (6) Per-window stability: autocorrelation BPM over 10 s windows, 5 s step.
  const winLen = Math.round(fs * 10);
  const winStep = Math.max(1, Math.round(fs * 5));
  const windowBpms: number[] = [];
  for (let start = 0; start + winLen <= sig.length; start += winStep) {
    const sub = sig.slice(start, start + winLen);
    const wHz = dominantFrequencyHz(sub, fs, 0.66, 3.0, 0.2);
    if (wHz > 0) windowBpms.push(Math.round(wHz * 60));
  }
  const totalWindows = windowBpms.length;
  const acceptedWindows = windowBpms.filter((w) => Math.abs(w - bpm) <= 15).length;

  // Temporal consistency vs a prior validated estimate: if this scan is a clean
  // halving/doubling glitch, reconcile toward the prior. Only when our own SNR
  // is not strong enough to override it.
  if (priorBpm && priorBpm > 0 && Math.abs(bpm - priorBpm) > 15 && snr < 0.3) {
    if (Math.abs(2 * bpm - priorBpm) <= 10) bpm = 2 * bpm; // we halved
    else if (Math.abs(bpm / 2 - priorBpm) <= 10) bpm = Math.round(bpm / 2); // we doubled
  }

  // Plausibility + quality gates.
  if (bpm < 40 || bpm > 180) return { ...EMPTY, duplicates: dupGap.duplicates, drops: dupGap.drops };
  const majorityStable = totalWindows === 0 || acceptedWindows / totalWindows >= 0.5;
  if (snr < 0.15 || prom < 2.0 || !majorityStable) {
    // The capture is too noisy / unstable to trust — report null honestly.
    return {
      bpm: null,
      snr,
      prominence: prom,
      acceptedWindows,
      totalWindows,
      duplicates: dupGap.duplicates,
      drops: dupGap.drops,
    };
  }

  return {
    bpm,
    snr,
    prominence: prom,
    acceptedWindows,
    totalWindows,
    duplicates: dupGap.duplicates,
    drops: dupGap.drops,
  };
}