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
const LEFT_CHEEK = 234;
const RIGHT_CHEEK = 454;
const FOREHEAD = 10;
const NOSE_TIP = 1;

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
  landmarks: Landmark[] | undefined,
  prevCenter: { x: number; y: number } | null,
): RoiResult {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) {
    return emptyRoi();
  }

  const canvas = sampleRoiCanvas(video, w, h);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return emptyRoi();

  if (!landmarks || landmarks.length === 0) {
    return { ...emptyRoi(), faceDetected: false };
  }

  // Cheek ROIs: small boxes centered on each cheek, offset away from eyes/mouth.
  const half = Math.min(w, h) * 0.06;
  const rois: { x: number; y: number; w: number; h: number }[] = [];
  const cheekCenter = (idx: number, awayX: number, awayY: number) => {
    const c = landmarks[idx];
    const nose = landmarks[NOSE_TIP];
    if (!c || !nose) return null;
    const dx = c.x - nose.x;
    const dy = c.y - nose.y;
    return {
      x: (nose.x + dx * awayX) * w - half,
      y: (nose.y + dy * awayY) * h - half,
      w: half * 2,
      h: half * 2,
    };
  };
  const leftCheek = cheekCenter(LEFT_CHEEK, 1.4, 0.6);
  const rightCheek = cheekCenter(RIGHT_CHEEK, 1.4, 0.6);
  if (leftCheek) rois.push(leftCheek);
  if (rightCheek) rois.push(rightCheek);

  // Forehead ROI: above the nose, between the eyes.
  const forehead = landmarks[FOREHEAD];
  const nose = landmarks[NOSE_TIP];
  if (forehead && nose) {
    rois.push({
      x: forehead.x * w - half,
      y: forehead.y * h - half * 0.7,
      w: half * 2,
      h: half * 1.4,
    });
  }

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

  if (count === 0) return { ...emptyRoi(), faceDetected: true, validRois: 0 };

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

  // Motion: raw nose displacement in normalized coords (drives the UI meter and
  // the per-frame HR mask). Kept SEPARATE from faceStability so motion is not
  // double-counted in the confidence formula.
  const center = nose ? { x: nose.x, y: nose.y } : null;
  let motionScore = 0.9;
  if (prevCenter && center) {
    const dist = Math.hypot(center.x - prevCenter.x, center.y - prevCenter.y);
    motionScore = Math.max(0, 1 - dist * 20);
  }

  // faceStability is INDEPENDENT of motionScore: it combines ROI visibility
  // (how many landmark boxes returned pixels) with a face-size-normalized
  // stillness (nose displacement divided by inter-cheek distance, so a small
  // face far away is not penalised for the same pixel motion as a close face).
  const visibility = validRois / 3;
  let stillness = motionScore;
  if (leftCheek && rightCheek) {
    const lc = landmarks[LEFT_CHEEK];
    const rc = landmarks[RIGHT_CHEEK];
    if (lc && rc) {
      const interocular = Math.hypot(lc.x - rc.x, lc.y - rc.y) || 1;
      const rawDisp = prevCenter && center
        ? Math.hypot(center.x - prevCenter.x, center.y - prevCenter.y)
        : 0;
      stillness = Math.max(0, 1 - (rawDisp / interocular) * 8);
    }
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
  private prevCenter: { x: number; y: number } | null = null;
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
    const landmarks = result.faceLandmarks?.[0];
    const roi = sampleRoiFromFrame(this.video, landmarks, this.prevCenter);
    if (landmarks?.[NOSE_TIP]) {
      this.prevCenter = { x: landmarks[NOSE_TIP].x, y: landmarks[NOSE_TIP].y };
    }
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
    this.prevCenter = null;
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