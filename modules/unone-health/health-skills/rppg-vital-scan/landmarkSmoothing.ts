/**
 * Pure landmark temporal smoothing for face rPPG. No DOM — fully unit-testable.
 *
 * WHY: MediaPipe FaceLandmarker landmarks jitter frame-to-frame by a few pixels
 * even on a perfectly still face (detector quantisation + model noise). That
 * jitter moves the ROI box, so each frame samples slightly different skin
 * pixels; the spatial gradient of skin colour then leaks into the per-frame
 * R/G/B means as broadband noise that masquerades as a poorer pulse SNR and
 * raises run-to-run HR variance. Exponential-moving-average smoothing of the
 * landmark coordinates stabilises the ROI on a still face (the dominant case
 * for a guided scan) while still letting it track real head movement.
 *
 * An EMA with α = 0.5 has a ~33 ms time constant at 30 fps — it tracks head
 * motion within one frame but averages sub-pixel landmark noise. Frames with
 * real motion are already gated out downstream (frameKept drops motion < 0.4),
 * so the small lag during motion never corrupts the HR trace.
 *
 * EXPERIMENTAL — not clinically validated.
 */

export interface Point {
  x: number;
  y: number;
}

/** EMA of a single point. `prev = null` (first frame) returns `raw` unchanged. */
export function smoothPoint(prev: Point | null, raw: Point, alpha: number): Point {
  if (prev === null) return { x: raw.x, y: raw.y };
  const a = clampAlpha(alpha);
  return {
    x: a * raw.x + (1 - a) * prev.x,
    y: a * raw.y + (1 - a) * prev.y,
  };
}

/** EMA-smooth a sparse set of named landmarks. Only the keys present in both
 * `prev` and `raw` are blended; keys new to `raw` seed with their raw value;
 * keys missing from `raw` are dropped (the ROI will simply use fewer regions
 * for that frame, which the visibility term already penalises). Returns the
 * smoothed map (a fresh object — `prev` is never mutated). */
export function smoothLandmarks(
  prev: Partial<Record<number, Point>> | null,
  raw: Partial<Record<number, Point>>,
  alpha: number,
): Partial<Record<number, Point>> {
  const a = clampAlpha(alpha);
  const out: Partial<Record<number, Point>> = {};
  for (const key of Object.keys(raw)) {
    const idx = Number(key);
    const r = raw[idx];
    if (!r) continue;
    const p = prev?.[idx] ?? null;
    out[idx] = smoothPoint(p, r, a);
  }
  return out;
}

/** Distance between two smoothed landmarks in normalized image coords. Used
 * to derive a face-scale (inter-ocular) length for ROI sizing that adapts to
 * how close the user is to the camera — a fixed pixel box is too small for a
 * distant face and too large (crosses into eyes/hair) for a close one. */
export function landmarkDistance(
  lm: Partial<Record<number, Point>>,
  a: number,
  b: number,
): number {
  const pa = lm[a];
  const pb = lm[b];
  if (!pa || !pb) return 0;
  return Math.hypot(pa.x - pb.x, pa.y - pb.y);
}

function clampAlpha(alpha: number): number {
  if (!Number.isFinite(alpha)) return 0.5;
  return Math.max(0, Math.min(1, alpha));
}