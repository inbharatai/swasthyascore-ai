/**
 * Pure waveform rendering math — DOM-free so it is unit-testable and reusable
 * by the live camera-scan canvas. The live pulse trace must visually match what
 * the engine processes, so we reuse the same `detrend` the HR pipeline uses
 * (window 15) rather than a cheaper bespoke running-mean.
 */
import { detrend } from "./signal";

export interface WaveformPoint {
  x: number;
  y: number;
}

/**
 * Map a raw green-channel sample series to normalized `[0..width] x [0..height]`
 * polyline points for drawing a live PPG waveform.
 *
 * - Applies `detrend(samples, 15)` (matches `estimateHeartRate`'s preprocessing).
 * - Normalizes the detrended window to the full `height` range, centered on the
 *   vertical midline, with a divide-by-zero guard for a flat (pulse-less) signal
 *   (returns a flat line at the midline — not a NaN/Infinity blow-up).
 * - Returns one point per input sample (`points.length === samples.length`),
 *   evenly spaced across `width`.
 */
export function computeWaveformPoints(
  samples: number[],
  width: number,
  height: number,
): WaveformPoint[] {
  const n = samples.length;
  if (n === 0 || width <= 0 || height <= 0) return [];

  const detrended = detrend(samples, 15);

  let maxAbs = 0;
  for (const v of detrended) {
    const a = Math.abs(v);
    if (a > maxAbs) maxAbs = a;
  }

  const mid = height / 2;
  const amp = maxAbs > 0 ? height * 0.42 : 0;
  const points: WaveformPoint[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const x = n === 1 ? 0 : (i / (n - 1)) * width;
    const normalized = maxAbs > 0 ? detrended[i] / maxAbs : 0;
    const y = mid - normalized * amp;
    points[i] = { x, y };
  }
  return points;
}