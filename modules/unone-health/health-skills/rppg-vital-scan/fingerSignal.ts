/**
 * Finger-mode (rear-camera, fingertip-over-lens) rPPG signal-quality metrics.
 *
 * Pure + stateless so the real `FingerFrameProvider` and the unit tests share
 * one source of truth. The provider keeps a rolling buffer of recent red-channel
 * means and calls this each frame; the outputs map onto `RppgFrameSample` so the
 * existing confidence policy (`confidence.ts`) works unchanged.
 *
 * Why these metrics, as a medical-engineering choice:
 *   - motionScore  : frame-to-frame delta of the red mean. A still finger with a
 *     pulse has small, consistent deltas (~1–3 units); finger pressure changes
 *     or hand tremor produce large erratic deltas. 1 = perfectly still.
 *   - stability    : variance of the frame-to-frame delta series. Stationary
 *     signal (steady pulse + steady pressure) → low delta-variance → high
 *     stability. This is NOT raw red variance (which the pulse itself raises).
 *   - pulsatility  : AC/DC ratio after detrend — the canonical PPG signal-strength
 *     metric. A good fingertip PPG has AC/DC ~ 0.005–0.02; we map that to 0..1.
 *     Fed into the confidence weight that face mode uses for left/right cheek
 *     consistency, so finger confidence reflects REAL signal strength, not a
 *     constant.
 *   - lightingScore: DC brightness in the usable band. With the torch on the
 *     frame floods bright; off but well-placed still lands in band.
 *
 * EXPERIMENTAL — not clinically validated. These metrics drive a confidence
 * score that gates whether HR is shown; they are not a medical measurement.
 */

/** Rolling-window length used by the provider (~1s at 30fps). */
export const FINGER_WINDOW = 30;

/** Frame-to-frame red-mean delta above which the frame is treated as moving. */
const MOTION_DELTA_SCALE = 10; // units on a 0..255 channel

/** AC/DC ratios that map to pulsatility 0 and 1. */
const PULSATILITY_FLOOR = 0.002;
const PULSATILITY_CEIL = 0.02;

export interface FingerQualityInput {
  /** Rolling red-channel means (DC-coupled), most recent last. ≥1 value. */
  recentReds: number[];
  /** Previous frame's red mean (for the instantaneous motion delta). */
  prevRed: number | null;
  /** Current frame DC brightness, 0..255. */
  brightness: number;
}

export interface FingerQuality {
  /** 0..1, 1 = still. */
  motionScore: number;
  /** 0..1, 1 = stationary signal. */
  stability: number;
  /** 0..1, real AC/DC PPG signal strength. */
  pulsatility: number;
  /** 0..1, DC brightness in usable band. */
  lightingScore: number;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function std(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  const v = xs.reduce((a, b) => a + (b - m) * (b - m), 0) / xs.length;
  return Math.sqrt(v);
}

/** First discrete difference: deltas[i] = xs[i+1] - xs[i]. */
function diffs(xs: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < xs.length; i++) out.push(xs[i] - xs[i - 1]);
  return out;
}

/**
 * Detrend by subtracting a centered moving average (same primitive the HR
 * pipeline uses). Removes slow pressure/drift changes so the residual is the
 * pulsatile AC component.
 */
function detrend(xs: number[], windowSize = 15): number[] {
  if (xs.length === 0) return [];
  const out = new Array<number>(xs.length).fill(0);
  const half = Math.floor(windowSize / 2);
  for (let i = 0; i < xs.length; i++) {
    let sum = 0;
    let count = 0;
    for (let j = -half; j <= half; j++) {
      const k = i + j;
      if (k >= 0 && k < xs.length) {
        sum += xs[k];
        count++;
      }
    }
    out[i] = xs[i] - sum / count;
  }
  return out;
}

export function computeFingerSignalQuality(
  input: FingerQualityInput,
): FingerQuality {
  const { recentReds, prevRed, brightness } = input;

  // --- motionScore: instantaneous frame-to-frame delta ----------------------
  let motionScore = 0.9;
  if (prevRed != null && recentReds.length > 0) {
    const last = recentReds[recentReds.length - 1];
    const delta = Math.abs(last - prevRed);
    motionScore = clamp01(1 - delta / MOTION_DELTA_SCALE);
  }

  // --- stability: variance of the delta series (stationary => low) ----------
  const dSeries = diffs(recentReds);
  const dStd = std(dSeries);
  // A steady pulse has small consistent deltas (dStd ~1–3); motion/tremor
  // pushes dStd into double digits. Scale so ~5 → 0.
  const stability = clamp01(1 - dStd / 5);

  // --- pulsatility: AC/DC after detrend -------------------------------------
  let pulsatility = 0;
  const dc = mean(recentReds);
  if (dc > 0 && recentReds.length >= 8) {
    const ac = std(detrend(recentReds, 15));
    const acDc = ac / dc;
    pulsatility = clamp01(
      (acDc - PULSATILITY_FLOOR) / (PULSATILITY_CEIL - PULSATILITY_FLOOR),
    );
  }

  // --- lightingScore: DC brightness in usable band --------------------------
  let lightingScore = 0.3;
  if (brightness < 50 || brightness > 250) {
    lightingScore = 0.2;
  } else if (brightness < 80) {
    lightingScore = 0.6;
  } else {
    lightingScore = 0.9;
  }

  return { motionScore, stability, pulsatility, lightingScore };
}