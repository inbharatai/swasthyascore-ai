/**
 * Pure resampling utilities. rPPG samples arrive on a jittery, duplicate-laced
 * rAF cadence — never on the uniform grid the autocorrelation/FFT math assumes.
 * Resampling onto a uniform timebase before any frequency estimation is the
 * single biggest real-world fix (Chen 2025: timestamp correction keeps MAE
 * ~4.5 vs 15.1 without, on nominally-25fps webcams that actually delivered
 * 20–30 fps).
 *
 * All functions are pure (no DOM, no `Date.now`).
 */

export interface ResampleResult {
  /** Values interpolated onto the uniform grid. */
  values: number[];
  /** Uniform sample rate (Hz) actually used (=== targetHz when feasible). */
  sampleRate: number;
  /** First timestamp (ms) the grid covers. */
  startMs: number;
  /** Count of detected duplicate frames (Δt < 0.5×median). */
  duplicates: number;
  /** Count of detected dropped frames / gaps (Δt > 1.5×median). */
  drops: number;
}

/**
 * Classify per-frame intervals vs the median cadence so callers can report
 * capture quality. Returns counts of duplicates (too-close frames — same camera
 * frame sampled twice) and drops (too-far frames — a camera frame was missed).
 */
export function detectDropsAndDuplicates(timestampsMs: number[]): {
  duplicates: number;
  drops: number;
  medianPeriodMs: number;
} {
  if (timestampsMs.length < 2) return { duplicates: 0, drops: 0, medianPeriodMs: 0 };
  const deltas: number[] = [];
  for (let i = 1; i < timestampsMs.length; i++) {
    deltas.push(timestampsMs[i] - timestampsMs[i - 1]);
  }
  const sorted = deltas.slice().sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  let duplicates = 0;
  let drops = 0;
  for (const d of deltas) {
    if (d < 0.5 * median) duplicates++;
    else if (d > 1.5 * median) drops++;
  }
  return { duplicates, drops, medianPeriodMs: median };
}

/**
 * Monotone cubic Hermite interpolation (Fritsch–Carlson). Robust to the
 * non-monotonic spacing and avoids the overshoot/ringing of a plain natural
 * cubic spline — important for PPG, where a ringing interpolator would invent
 * false peaks that the autocorrelation then locks onto.
 *
 * Given knot points (t_k, y_k) it returns the interpolated value at query time t.
 */
function monotoneCubicHermite(
  ts: number[],
  ys: number[],
  ms: number[],
  t: number,
): number {
  const n = ts.length;
  // Clamp query to the knot range (flat extrapolation at the ends).
  if (t <= ts[0]) return ys[0];
  if (t >= ts[n - 1]) return ys[n - 1];

  // Binary search for the bracketing interval [k, k+1].
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (ts[mid] <= t) lo = mid;
    else hi = mid;
  }
  const k = lo;
  const dt = ts[k + 1] - ts[k];
  if (dt <= 0) return ys[k];
  const s = (t - ts[k]) / dt;
  const s2 = s * s;
  const s3 = s2 * s;

  // Hermite basis: h00, h10, h01, h11.
  const h00 = 2 * s3 - 3 * s2 + 1;
  const h10 = s3 - 2 * s2 + s;
  const h01 = -2 * s3 + 3 * s2;
  const h11 = s3 - s2;
  return (
    h00 * ys[k] +
    h10 * dt * ms[k] +
    h01 * ys[k + 1] +
    h11 * dt * ms[k + 1]
  );
}

/** Compute Fritsch–Carlson monotone tangents at each knot. */
function monotoneTangents(ts: number[], ys: number[]): number[] {
  const n = ts.length;
  if (n === 0) return [];
  if (n === 1) return [0];
  const slopes: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const dt = ts[i + 1] - ts[i];
    slopes.push(dt !== 0 ? (ys[i + 1] - ys[i]) / dt : 0);
  }
  const m = new Array<number>(n).fill(0);
  m[0] = slopes[0];
  m[n - 1] = slopes[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (slopes[i - 1] * slopes[i] <= 0) {
      m[i] = 0; // sign change or flat -> zero tangent (preserves monotonicity)
    } else {
      m[i] = (slopes[i - 1] + slopes[i]) / 2;
    }
  }
  // Clamp tangents to avoid overshoot (Fritsch–Carlson step).
  for (let i = 0; i < n - 1; i++) {
    if (slopes[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
    } else {
      const alpha = m[i] / slopes[i];
      const beta = m[i + 1] / slopes[i];
      const r = alpha * alpha + beta * beta;
      if (r > 9) {
        const tau = 3 / Math.sqrt(r);
        m[i] = tau * alpha * slopes[i];
        m[i + 1] = tau * beta * slopes[i];
      }
    }
  }
  return m;
}

/**
 * Resample a non-uniformly-sampled signal onto a uniform grid at `targetHz`.
 * Skips duplicate frames first (collapses runs where Δt < 0.5×median to the
 * first sample), then interpolates with monotone cubic Hermite.
 *
 * If there are too few unique samples (< 4) or no usable span, returns an empty
 * result so the caller can fall back / null the reading.
 */
export function resampleUniform(
  values: number[],
  timestampsMs: number[],
  targetHz: number,
): ResampleResult {
  const empty: ResampleResult = {
    values: [],
    sampleRate: targetHz,
    startMs: 0,
    duplicates: 0,
    drops: 0,
  };
  if (values.length < 4 || timestampsMs.length < 4 || targetHz <= 0) return empty;
  if (values.length !== timestampsMs.length) return empty;

  const { duplicates, drops } = detectDropsAndDuplicates(timestampsMs);

  // Collapse duplicates: keep only samples whose timestamp advanced past the
  // median half-period since the previous kept sample.
  const median = detectDropsAndDuplicates(timestampsMs).medianPeriodMs || 16.67;
  const keepIdx: number[] = [0];
  for (let i = 1; i < timestampsMs.length; i++) {
    if (timestampsMs[i] - timestampsMs[keepIdx[keepIdx.length - 1]] >= 0.5 * median) {
      keepIdx.push(i);
    }
  }
  const ts = keepIdx.map((i) => timestampsMs[i]);
  const ys = keepIdx.map((i) => values[i]);
  if (ts.length < 4) return { ...empty, duplicates, drops };

  const m = monotoneTangents(ts, ys);
  const startMs = ts[0];
  const endMs = ts[ts.length - 1];
  const stepMs = 1000 / targetHz;
  const out: number[] = [];
  for (let t = startMs; t <= endMs + 1e-6; t += stepMs) {
    out.push(monotoneCubicHermite(ts, ys, m, t));
  }
  return { values: out, sampleRate: targetHz, startMs, duplicates, drops };
}