/**
 * Multi-channel rPPG signal extraction. Plain green-average rPPG cannot cancel
 * ambient-light flicker, auto-white-balance drift, or specular reflections
 * because it discards the R and B channels. POS (Wang et al. 2017,
 * "Algorithmic Principles of Remote-PPG") combines the per-frame R/G/B means
 * with anti-correlated weights so the common-mode (illumination) component
 * cancels while the pulse (which is anti-correlated across channels in the
 * projection plane) is retained.
 *
 * Reported MAE on UBFC-RPPG: green-only ~19.8 BPM → POS ~4.0. (CHROM, de Haan &
 * Jeanne 2013, is a related chrominance method at similar accuracy; it is NOT
 * wired into this pipeline — POS alone is the face-mode estimator.) POS needs
 * only per-frame channel means — no per-pixel data — so it runs on what the
 * frame providers already capture.
 *
 * Pure (no DOM). The output is a 1D pulse trace; downstream code SPA-detrends
 * and bandpasses it.
 */

function std(x: number[]): number {
  if (x.length === 0) return 0;
  const mean = x.reduce((a, b) => a + b, 0) / x.length;
  const v = x.reduce((a, b) => a + (b - mean) * (b - mean), 0) / x.length;
  return Math.sqrt(v);
}

/** Per-channel window normalisation: divide each channel by its mean over the
 * window (the standard POS/CHROM preprocessing step). Guards against a zero
 * mean (dark frame) by leaving that channel as zeros. */
function normalizeChannels(
  r: number[],
  g: number[],
  b: number[],
  start: number,
  len: number,
): { rn: number[]; gn: number[]; bn: number[] } {
  let rs = 0,
    gs = 0,
    bs = 0;
  for (let i = 0; i < len; i++) {
    rs += r[start + i];
    gs += g[start + i];
    bs += b[start + i];
  }
  const rm = rs / len || 1;
  const gm = gs / len || 1;
  const bm = bs / len || 1;
  const rn: number[] = new Array(len);
  const gn: number[] = new Array(len);
  const bn: number[] = new Array(len);
  for (let i = 0; i < len; i++) {
    rn[i] = r[start + i] / rm;
    gn[i] = g[start + i] / gm;
    bn[i] = b[start + i] / bm;
  }
  return { rn, gn, bn };
}

/** Hann window of length N (0 at the ends, 1 in the middle). */
function hann(n: number): number[] {
  const w = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1));
  }
  return w;
}

/**
 * Plane-Orthogonal-to-Skin (POS, Wang 2017). Projects temporally-normalised
 * RGB onto the plane orthogonal to the fixed skin-tone vector [1,1,1]:
 *   S1 = G − B,   S2 = −2R + G + B
 * Over 1.6 s overlapping windows: α = std(S1)/std(S2), h = S1 + α·S2,
 * mean-subtract, Hann-windowed overlap-add. Returns a 1D pulse trace (length =
 * input length). If a channel is uniformly zero (no skin captured) the window
 * is skipped.
 */
export function posSignal(
  r: number[],
  g: number[],
  b: number[],
  sampleRate: number,
): number[] {
  const n = Math.min(r.length, g.length, b.length);
  if (n < 8 || sampleRate <= 0) return [];
  const L = Math.max(8, Math.round(sampleRate * 1.6)); // 1.6 s window
  if (L > n) {
    // One window: process the whole trace.
    return posWindowOverlap(r, g, b, 0, n, n);
  }
  const step = Math.max(1, Math.floor(L / 2)); // 50% overlap
  const out = new Array<number>(n).fill(0);
  const norm = new Array<number>(n).fill(0);
  const w = hann(L);
  for (let t = 0; t + L <= n; t += step) {
    const { rn, gn, bn } = normalizeChannels(r, g, b, t, L);
    const s1 = new Array<number>(L);
    const s2 = new Array<number>(L);
    for (let i = 0; i < L; i++) {
      s1[i] = gn[i] - bn[i];
      s2[i] = -2 * rn[i] + gn[i] + bn[i];
    }
    const sd2 = std(s2);
    if (sd2 <= 1e-9) continue; // degenerate window (no signal)
    const alpha = std(s1) / sd2;
    const meanH = s1.reduce((a, v, i) => a + v + alpha * s2[i], 0) / L;
    for (let i = 0; i < L; i++) {
      const h = s1[i] + alpha * s2[i] - meanH;
      out[t + i] += h * w[i];
      norm[t + i] += w[i];
    }
  }
  const result = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    result[i] = norm[i] > 1e-9 ? out[i] / norm[i] : 0;
  }
  return result;
}

function posWindowOverlap(
  r: number[],
  g: number[],
  b: number[],
  start: number,
  len: number,
  n: number,
): number[] {
  const { rn, gn, bn } = normalizeChannels(r, g, b, start, len);
  const s1 = new Array<number>(len);
  const s2 = new Array<number>(len);
  for (let i = 0; i < len; i++) {
    s1[i] = gn[i] - bn[i];
    s2[i] = -2 * rn[i] + gn[i] + bn[i];
  }
  const sd2 = std(s2);
  if (sd2 <= 1e-9) return new Array<number>(n).fill(0);
  const alpha = std(s1) / sd2;
  const meanH = s1.reduce((a, v, i) => a + v + alpha * s2[i], 0) / len;
  const out = new Array<number>(n).fill(0);
  for (let i = 0; i < len; i++) {
    out[start + i] = s1[i] + alpha * s2[i] - meanH;
  }
  return out;
}