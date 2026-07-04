"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Browser-only real rPPG engine. Client component — dynamically imports
 * `@mediapipe/tasks-vision` (already a dependency) so it never loads on the
 * server or in the Node test environment.
 *
 * EXPERIMENTAL — NOT CLINICALLY VALIDATED. The POS / red-channel -> SPA detrend
 * -> zero-phase bandpass -> Welch + autocorrelation pipeline gives a plausible
 * heart-rate estimate under reasonable lighting with a still face/finger, but
 * single-camera rPPG is not a medical measurement. Results are tagged
 * `engine: "signal"` and the UI must surface the confidence score + "not
 * clinically validated" note.
 */
import type { RppgEngine, RppgScanParams, RppgScanSamples, RppgFrameSample } from "./engine";
import { aggregateFrameSamples } from "./engine";
import { computeFingerSignalQuality, FINGER_WINDOW } from "./fingerSignal";
import {
  smoothLandmarks,
  landmarkDistance,
  type Point,
} from "./landmarkSmoothing";

// Self-hosted (in /public) so the first rPPG scan works on any network without
// depending on googleapis / jsdelivr CDNs (which are blocked on some networks
// and required an online first run previously). Served statically by Vercel.
const WASM_PATH = "/models/wasm";
const FACE_MODEL_PATH = "/models/face_landmarker.task";

type Landmark = { x: number; y: number; z?: number; visibility?: number };
type FaceLandmarker = {
  detectForVideo: (
    video: HTMLVideoElement,
    timestampMs: number,
  ) => { faceLandmarks?: Landmark[][] };
  close?: () => void;
};

let faceLandmarkerPromise: Promise<FaceLandmarker> | null = null;

async function createFaceLandmarker(): Promise<FaceLandmarker> {
  if (!faceLandmarkerPromise) {
    faceLandmarkerPromise = import("@mediapipe/tasks-vision").then(
      async ({ FilesetResolver, FaceLandmarker }: any) => {
        const vision = await FilesetResolver.forVisionTasks(WASM_PATH);
        const baseOptions = { modelAssetPath: FACE_MODEL_PATH };
        try {
          return await FaceLandmarker.createFromOptions(vision, {
            baseOptions: { ...baseOptions, delegate: "GPU" },
            runningMode: "VIDEO",
            numFaces: 1,
          });
        } catch {
          return await FaceLandmarker.createFromOptions(vision, {
            baseOptions,
            runningMode: "VIDEO",
            numFaces: 1,
          });
        }
      },
    );
  }
  return faceLandmarkerPromise;
}

/** Mediapipe FaceLandmarker landmark indices for the rPPG ROI. */
const LEFT_CHEEK = 234; // subject's left cheek (image right when mirrored)
const RIGHT_CHEEK = 454;
const NOSE_TIP = 1;
const NASION = 6; // between the eyebrows — reliable forehead anchor
const LEFT_EYE_OUTER = 33; // canonical inter-ocular scale pair
const RIGHT_EYE_OUTER = 263;
const FOREHEAD_TOP = 10; // hairline — used to cap the forehead ROI

/** EMA smoothing factor for landmark coordinates. α = 0.5 → ~33 ms time
 * constant at 30 fps: tracks real head motion within one frame while averaging
 * sub-pixel detector jitter that otherwise destabilises the ROI. See
 * `landmarkSmoothing.ts` for the rationale. */
const LM_SMOOTH_ALPHA = 0.5;

/** Indices we actually read for the ROI. Smoothing only these keeps the work
 * cheap (≤7 points/frame) and the state tiny. */
const ROI_INDICES = [LEFT_CHEEK, RIGHT_CHEEK, NOSE_TIP, NASION, LEFT_EYE_OUTER, RIGHT_EYE_OUTER, FOREHEAD_TOP];

interface RoiResult {
  greenMean: number;
  redMean: number;
  blueMean: number;
  faceStability: number;
  motionScore: number;
  lightingScore: number;
  leftRightConsistency: number;
  faceDetected: boolean;
  validRois: number;
}

function sampleRoiFromFrame(
  video: HTMLVideoElement,
  smoothed: Partial<Record<number, Point>> | null,
  prevNose: Point | null,
): RoiResult {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) {
    return emptyRoi();
  }

  const canvas = sampleRoiCanvas(video, w, h);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return emptyRoi();

  if (!smoothed) {
    return { ...emptyRoi(), faceDetected: false };
  }

  // Face scale = inter-ocular distance (outer-eye to outer-eye), in NORMALIZED
  // coords. Sizing the ROI boxes to this adapts to how close the user is: a
  // fixed pixel box is too small for a distant face (too few pulse pixels) and
  // too large for a close face (crosses into eyes/hair/eyebrows). Fall back to
  // cheek-to-cheek distance if the eye landmarks are missing.
  const interocular =
    landmarkDistance(smoothed, LEFT_EYE_OUTER, RIGHT_EYE_OUTER) ||
    landmarkDistance(smoothed, LEFT_CHEEK, RIGHT_CHEEK) ||
    0;
  if (interocular <= 0) {
    // Landmarks present but no usable face scale (no eyes AND no cheeks). Treat
    // as no-face so the provider drops this frame (returns null) instead of
    // pushing a zero-mean sample into the trace — a zero sample is a spike
    // artefact that the bandpass/autocorrelation would lock onto.
    return { ...emptyRoi(), faceDetected: false, validRois: 0 };
  }

  const nose = smoothed[NOSE_TIP];
  const nasion = smoothed[NASION];
  const foreheadTop = smoothed[FOREHEAD_TOP];

  const rois: { x: number; y: number; w: number; h: number }[] = [];

  // Forehead ROI: centered above the nasion (between the brows), wide and short,
  // capped below the hairline by FOREHEAD_TOP so it stays on skin. Width ~1.0 ×
  // inter-ocular, height ~0.45 × inter-ocular.
  if (nasion) {
    const fw = interocular * 1.0;
    const fh = interocular * 0.45;
    const cx = nasion.x;
    // Place the box so its BOTTOM sits just above the brows (nasion y − a small
    // gap), top bounded by FOREHEAD_TOP so hair never enters.
    let topY = nasion.y - fh * 1.1;
    if (foreheadTop) topY = Math.max(topY, foreheadTop.y + fh * 0.1);
    rois.push({
      x: (cx - fw / 2) * w,
      y: topY * h,
      w: fw * w,
      h: fh * h,
    });
  }

  // Cheek ROIs: each cheek center is pushed OUTWARD from the nose by a fraction
  // of the nose→cheek vector (sits on the fleshy cheek, clear of the eye/mouth).
  // Box side ~0.55 × inter-ocular — large enough for solid spatial averaging.
  const cheekBox = (idx: number, pushOut: number, downShift: number) => {
    const cheek = smoothed[idx];
    if (!cheek || !nose) return null;
    const dx = cheek.x - nose.x;
    const dy = cheek.y - nose.y;
    const side = interocular * 0.55;
    return {
      x: (nose.x + dx * pushOut - side / 2) * w,
      y: (nose.y + dy * downShift + side * 0.1 - side / 2) * h,
      w: side * w,
      h: side * h,
    };
  };
  const leftCheek = cheekBox(LEFT_CHEEK, 1.35, 0.55);
  const rightCheek = cheekBox(RIGHT_CHEEK, 1.35, 0.55);
  if (leftCheek) rois.push(leftCheek);
  if (rightCheek) rois.push(rightCheek);

  let redSum = 0;
  let greenSum = 0;
  let blueSum = 0;
  let greenSumSq = 0;
  let count = 0;
  let validRois = 0;
  for (const roi of rois) {
    const x0 = Math.max(0, Math.round(roi.x));
    const y0 = Math.max(0, Math.round(roi.y));
    const x1 = Math.min(w, Math.round(roi.x + roi.w));
    const y1 = Math.min(h, Math.round(roi.y + roi.h));
    if (x1 <= x0 || y1 <= y0) continue;
    try {
      const region = ctx.getImageData(x0, y0, x1 - x0, y1 - y0);
      const px = region.data;
      let rc = 0;
      for (let i = 0; i < px.length; i += 4) {
        const r = px[i];
        const g = px[i + 1];
        const b = px[i + 2];
        redSum += r;
        greenSum += g;
        blueSum += b;
        greenSumSq += g * g;
        count++;
        rc++;
      }
      if (rc > 0) validRois++;
    } catch {
      // tainted canvas or out of range — skip this ROI
    }
  }

  if (count === 0) {
    // ROIs were defined but yielded zero pixels (entirely off-screen / tainted).
    // Drop the frame (null) rather than emit zero channel means — see above.
    return { ...emptyRoi(), faceDetected: false, validRois: 0 };
  }

  const redMean = redSum / count;
  const greenMean = greenSum / count;
  const blueMean = blueSum / count;
  const brightness = (redMean + greenMean + blueMean) / 3; // 0..255

  // Continuous lighting score (replaces the old 3-bucket constant). Peak at
  // ~160 brightness, smooth roll-off at the extremes. Pulsatility term is the
  // spatial green AC/DC — a proxy for rPPG SNR (a flat, non-pulsatile ROI is a
  // bad ROI even if the brightness is nominal).
  const brightnessTerm =
    0.2 + 0.7 * (1 - Math.min(1, Math.abs(brightness - 160) / 110));
  const greenStd = Math.sqrt(Math.max(0, greenSumSq / count - greenMean * greenMean));
  const pulsatilityTerm = Math.min(1, (greenStd / Math.max(1, greenMean)) * 30);
  const lightingScore = Math.max(
    0,
    Math.min(1, 0.75 * brightnessTerm + 0.25 * pulsatilityTerm),
  );

  // Motion: nose displacement in NORMALIZED coords, scaled by inter-ocular so a
  // distant face is not penalised for the same pixel motion as a close one.
  // Computed on the SMOOTHED nose (less noisy than raw). Kept separate from
  // faceStability so motion is not double-counted in the confidence formula.
  const center = nose ? { x: nose.x, y: nose.y } : null;
  let motionScore = 0.9;
  if (prevNose && center) {
    const dist = Math.hypot(center.x - prevNose.x, center.y - prevNose.y);
    motionScore = Math.max(0, 1 - (dist / interocular) * 8);
  }

  // faceStability combines ROI visibility (how many boxes returned pixels) with
  // the same face-scale-normalised stillness used above.
  const visibility = validRois / 3;
  let stillness = motionScore;
  if (prevNose && center) {
    const rawDisp = Math.hypot(center.x - prevNose.x, center.y - prevNose.y);
    stillness = Math.max(0, 1 - (rawDisp / interocular) * 8);
  }
  const faceStability = Math.max(0, Math.min(1, 0.45 * visibility + 0.55 * stillness));

  // Left/right cheek consistency: compare green means of the two cheek boxes.
  // PENALISED (0.3) when a cheek is missing — a partial / profile face should not
  // read as high consistency.
  let leftRightConsistency = 0.3;
  if (leftCheek && rightCheek) {
    const leftMean = meanGreenInBox(ctx, leftCheek, w, h);
    const rightMean = meanGreenInBox(ctx, rightCheek, w, h);
    if (leftMean != null && rightMean != null) {
      const diff = Math.abs(leftMean - rightMean) / 255;
      leftRightConsistency = Math.max(0, 1 - diff * 5);
    }
  }

  return {
    greenMean,
    redMean,
    blueMean,
    faceStability,
    motionScore,
    lightingScore,
    leftRightConsistency,
    faceDetected: true,
    validRois,
  };
}

function meanGreenInBox(
  ctx: CanvasRenderingContext2D,
  roi: { x: number; y: number; w: number; h: number },
  w: number,
  h: number,
): number | null {
  const x0 = Math.max(0, Math.round(roi.x));
  const y0 = Math.max(0, Math.round(roi.y));
  const x1 = Math.min(w, Math.round(roi.x + roi.w));
  const y1 = Math.min(h, Math.round(roi.y + roi.h));
  if (x1 <= x0 || y1 <= y0) return null;
  try {
    const region = ctx.getImageData(x0, y0, x1 - x0, y1 - y0);
    let sum = 0;
    let count = 0;
    for (let i = 0; i < region.data.length; i += 4) {
      sum += region.data[i + 1];
      count++;
    }
    return count ? sum / count : null;
  } catch {
    return null;
  }
}

const sampleCanvas: HTMLCanvasElement | null =
  typeof document !== "undefined" ? document.createElement("canvas") : null;

function sampleRoiCanvas(
  video: HTMLVideoElement,
  w: number,
  h: number,
): HTMLCanvasElement {
  if (!sampleCanvas) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d");
    ctx?.drawImage(video, 0, 0, w, h);
    return c;
  }
  if (sampleCanvas.width !== w) sampleCanvas.width = w;
  if (sampleCanvas.height !== h) sampleCanvas.height = h;
  const ctx = sampleCanvas.getContext("2d", { willReadFrequently: true });
  ctx?.drawImage(video, 0, 0, w, h);
  return sampleCanvas;
}

function emptyRoi(): RoiResult {
  return {
    greenMean: 0,
    redMean: 0,
    blueMean: 0,
    faceStability: 0,
    motionScore: 0,
    lightingScore: 0,
    leftRightConsistency: 0,
    faceDetected: false,
    validRois: 0,
  };
}

/**
 * Frame provider bound to a live <video> element. The UI calls `sample()` on
 * each animation frame during the scan; it returns null when the face is not
 * detected OR when the underlying video frame has not advanced since the last
 * sample (a duplicate — common when rAF outruns the camera, e.g. 60 Hz display
 * driving a 30 fps camera). Dedup is the load-bearing fix for real-world BPM
 * accuracy: duplicates inflate the derived sample rate and bias the
 * autocorrelation.
 */
export class FaceRoiFrameProvider {
  /** Smoothed landmark coordinates for the indices in `ROI_INDICES`. EMA over
   * frames stabilises the ROI on a still face (see landmarkSmoothing.ts). */
  private smoothed: Partial<Record<number, Point>> = {};
  private prevNose: Point | null = null;
  private landmarker: FaceLandmarker | null = null;
  private lastMediaTime = -1;

  constructor(private readonly video: HTMLVideoElement) {}

  async ensureLandmarker(): Promise<void> {
    if (!this.landmarker) this.landmarker = await createFaceLandmarker();
  }

  sample(): RppgFrameSample | null {
    if (!this.landmarker) return null;
    // Dedup: skip if the video frame hasn't advanced since last sample.
    const mediaTime = this.video.currentTime;
    if (mediaTime === this.lastMediaTime) return null;
    this.lastMediaTime = mediaTime;
    // Timestamp the sample at capture time (before the slow detection call) so
    // detection latency jitter does not flow into the sample-rate derivation.
    const timestampMs = performance.now();
    const result = this.landmarker.detectForVideo(this.video, timestampMs);
    const raw = result.faceLandmarks?.[0];

    // Build a sparse map of the raw landmarks we actually use, then EMA-smooth
    // them against the previous frame. On a still face this kills the
    // sub-pixel detector jitter that otherwise wobbles the ROI and injects
    // broadband noise into the R/G/B means (a leading cause of run-to-run
    // HR fluctuation). The ROI placement + motion maths downstream consume
    // the SMOOTHED coordinates exclusively.
    const rawMap: Partial<Record<number, Point>> = {};
    if (raw) {
      for (const idx of ROI_INDICES) {
        const lm = raw[idx];
        if (lm) rawMap[idx] = { x: lm.x, y: lm.y };
      }
    }
    this.smoothed = smoothLandmarks(
      Object.keys(this.smoothed).length > 0 ? this.smoothed : null,
      rawMap,
      LM_SMOOTH_ALPHA,
    );

    const nose = this.smoothed[NOSE_TIP] ?? null;
    const roi = sampleRoiFromFrame(this.video, this.smoothed, this.prevNose);
    if (nose) this.prevNose = nose;
    if (!roi.faceDetected) return null;
    return {
      greenMean: roi.greenMean,
      redMean: roi.redMean,
      blueMean: roi.blueMean,
      timestampMs,
      mediaTime,
      faceStability: roi.faceStability,
      motionScore: roi.motionScore,
      lightingScore: roi.lightingScore,
      leftRightConsistency: roi.leftRightConsistency,
    };
  }

  release(): void {
    this.landmarker?.close?.();
    this.landmarker = null;
    this.smoothed = {};
    this.prevNose = null;
    this.lastMediaTime = -1;
  }
}

/**
 * Finger-over-rear-camera provider. No face ROI — averages a center crop's red
 * channel (the fingertip pressed over the lens, flooded by the torch, gives a
 * strong pulsing red PPG signal). Captures green+blue too for ambient-leak
 * detection (if green/blue rise while red is high, ambient light is leaking in
 * → "cover camera fully"). Heart-rate only; respiratory rate is never claimed.
 *
 * Per-frame quality is REAL: a rolling buffer of recent red means drives
 * `computeFingerSignalQuality` (frame-to-frame motion, delta-variance
 * stability, AC/DC pulsatility, DC-band lighting + contact quality). The red
 * mean is carried in `greenMean` (the pipeline's display/signal channel) so the
 * live waveform shows the pulsing red trace; the true red/green/blue are in
 * `redMean`/`greenMean`/`blueMean` for the HR estimator.
 */
export class FingerFrameProvider {
  private readonly recentReds: number[] = [];
  private prevRed: number | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private lastMediaTime = -1;

  constructor(private readonly video: HTMLVideoElement) {}

  sample(): RppgFrameSample | null {
    const w = this.video.videoWidth;
    const h = this.video.videoHeight;
    if (!w || !h) return null;

    // Dedup: skip duplicate video frames.
    const mediaTime = this.video.currentTime;
    if (mediaTime === this.lastMediaTime) return null;
    this.lastMediaTime = mediaTime;
    const timestampMs = performance.now();

    if (!this.canvas) this.canvas = document.createElement("canvas");
    const canvas = this.canvas;
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(this.video, 0, 0, w, h);

    // Center crop for speed; a fingertip-over-lens frame is uniformly red.
    const cx = Math.round(w * 0.35);
    const cy = Math.round(h * 0.35);
    const cw = Math.round(w * 0.3);
    const ch = Math.round(h * 0.3);
    let rs = 0;
    let gs = 0;
    let bs = 0;
    let count = 0;
    try {
      const region = ctx.getImageData(cx, cy, cw, ch);
      const px = region.data;
      for (let i = 0; i < px.length; i += 4) {
        rs += px[i];
        gs += px[i + 1];
        bs += px[i + 2];
        count++;
      }
    } catch {
      return null;
    }
    if (!count) return null;

    const redMean = rs / count;
    const greenMean = gs / count;
    const blueMean = bs / count;
    const brightness = (redMean + greenMean + blueMean) / 3;

    // Rolling buffer for the quality metrics.
    this.recentReds.push(redMean);
    if (this.recentReds.length > FINGER_WINDOW) this.recentReds.shift();

    const q = computeFingerSignalQuality({
      recentReds: this.recentReds,
      prevRed: this.prevRed,
      brightness,
      redMean,
      greenMean,
      blueMean,
    });
    this.prevRed = redMean;

    return {
      // Display/signal channel carries the pulsing red trace for the waveform.
      greenMean: redMean,
      redMean,
      blueMean,
      timestampMs,
      mediaTime,
      faceStability: q.stability,
      motionScore: q.motionScore,
      lightingScore: q.lightingScore,
      // Repurposed as AC/DC pulsatility for finger mode (contact PPG strength).
      leftRightConsistency: q.pulsatility,
    };
  }

  release(): void {
    this.recentReds.length = 0;
    this.prevRed = null;
    this.canvas = null;
    this.lastMediaTime = -1;
  }
}

export type RppgFrameProvider = FaceRoiFrameProvider | FingerFrameProvider;

/**
 * SignalRppgEngine — real engine. Runs a real-time rAF loop for the requested
 * duration, pulling one sample per frame from the bound provider, then
 * finalises via the shared pure math.
 */
export class SignalRppgEngine implements RppgEngine {
  readonly id = "signal" as const;

  constructor(private readonly provider: RppgFrameProvider) {}

  async scan(params: RppgScanParams): Promise<RppgScanSamples> {
    if ("ensureLandmarker" in this.provider) {
      await (this.provider as FaceRoiFrameProvider).ensureLandmarker();
    }
    const frames: RppgFrameSample[] = [];
    const start = performance.now();
    const durationMs = params.durationSeconds * 1000;

    await new Promise<void>((resolve) => {
      const tick = () => {
        if (params.signal?.aborted) {
          resolve();
          return;
        }
        const elapsed = performance.now() - start;
        const sample = this.provider.sample();
        if (sample) frames.push(sample);
        params.onProgress?.(Math.min(1, elapsed / durationMs));
        if (elapsed >= durationMs) {
          resolve();
        } else {
          requestAnimationFrame(tick);
        }
      };
      requestAnimationFrame(tick);
    });

    this.provider.release();
    return aggregateFrameSamples(frames);
  }
}