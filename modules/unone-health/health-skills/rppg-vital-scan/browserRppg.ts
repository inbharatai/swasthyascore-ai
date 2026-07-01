"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Browser-only real rPPG engine. Client component — dynamically imports
 * `@mediapipe/tasks-vision` (already a dependency) so it never loads on the
 * server or in the Node test environment.
 *
 * EXPERIMENTAL — NOT CLINICALLY VALIDATED. The green-channel -> bandpass ->
 * autocorrelation pipeline gives a plausible heart-rate estimate under good
 * lighting with a still face, but single-camera rPPG is not a medical
 * measurement. Results are tagged `engine: "signal"` and the UI must surface
 * the confidence score + "not clinically validated" note.
 */
import type { RppgEngine, RppgScanParams, RppgScanSamples, RppgFrameSample } from "./engine";
import { aggregateFrameSamples } from "./engine";

const WASM_PATH =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const FACE_MODEL_PATH =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

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
  faceStability: number;
  motionScore: number;
  lightingScore: number;
  leftRightConsistency: number;
  faceDetected: boolean;
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
    // push the box outward from the nose so it sits on the cheek, not near eye/mouth
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

  let greenSum = 0;
  let greenCount = 0;
  let brightSum = 0;
  let brightCount = 0;
  for (const roi of rois) {
    const x0 = Math.max(0, Math.round(roi.x));
    const y0 = Math.max(0, Math.round(roi.y));
    const x1 = Math.min(w, Math.round(roi.x + roi.w));
    const y1 = Math.min(h, Math.round(roi.y + roi.h));
    if (x1 <= x0 || y1 <= y0) continue;
    try {
      const region = ctx.getImageData(x0, y0, x1 - x0, y1 - y0);
      for (let i = 0; i < region.data.length; i += 4) {
        greenSum += region.data[i + 1];
        brightSum += region.data[i] + region.data[i + 1] + region.data[i + 2];
        greenCount++;
        brightCount++;
      }
    } catch {
      // tainted canvas or out of range — skip
    }
  }

  if (greenCount === 0) return { ...emptyRoi(), faceDetected: true };

  const greenMean = greenSum / greenCount;
  const brightness = brightSum / brightCount / 3; // 0..255

  // Lighting: ~100-200 is good; outside that range degrades.
  const lightingScore =
    brightness < 60 || brightness > 245
      ? 0.2
      : brightness < 90
        ? 0.6
        : 0.9;

  // Stability: how much the nose tip moved since last frame.
  const center = nose ? { x: nose.x, y: nose.y } : null;
  let motionScore = 0.9;
  if (prevCenter && center) {
    const dist = Math.hypot(center.x - prevCenter.x, center.y - prevCenter.y);
    motionScore = Math.max(0, 1 - dist * 20);
  }
  const faceStability = Math.min(1, motionScore * 0.9 + 0.1);

  // Left/right cheek consistency: compare green means of the two cheek boxes.
  let leftRightConsistency = 0.85;
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
    faceStability,
    motionScore,
    lightingScore,
    leftRightConsistency,
    faceDetected: true,
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
    // Should not happen in browser; return a fresh canvas as a fallback.
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
    faceStability: 0,
    motionScore: 0,
    lightingScore: 0,
    leftRightConsistency: 0,
    faceDetected: false,
  };
}

/**
 * Frame provider bound to a live <video> element. The UI calls `sample()` on
 * each animation frame during the scan; it returns null when the face is not
 * detected (so the UI can show "no face" feedback).
 */
export class FaceRoiFrameProvider {
  private prevCenter: { x: number; y: number } | null = null;
  private landmarker: FaceLandmarker | null = null;

  constructor(private readonly video: HTMLVideoElement) {}

  async ensureLandmarker(): Promise<void> {
    if (!this.landmarker) this.landmarker = await createFaceLandmarker();
  }

  sample(): RppgFrameSample | null {
    if (!this.landmarker) return null;
    const result = this.landmarker.detectForVideo(
      this.video,
      performance.now(),
    );
    const landmarks = result.faceLandmarks?.[0];
    const roi = sampleRoiFromFrame(this.video, landmarks, this.prevCenter);
    if (landmarks?.[NOSE_TIP]) {
      this.prevCenter = {
        x: landmarks[NOSE_TIP].x,
        y: landmarks[NOSE_TIP].y,
      };
    }
    if (!roi.faceDetected) return null;
    return {
      greenMean: roi.greenMean,
      timestampMs: performance.now(),
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
  }
}

/**
 * Finger-over-rear-camera provider. No face ROI — averages the whole frame's
 * red channel (the fingertip pressed over the flash floods the frame with a
 * pulsing red signal). Heart-rate only; respiratory rate is never claimed.
 */
export class FingerFrameProvider {
  constructor(private readonly video: HTMLVideoElement) {}

  sample(): RppgFrameSample | null {
    const w = this.video.videoWidth;
    const h = this.video.videoHeight;
    if (!w || !h) return null;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(this.video, 0, 0, w, h);
    // Sample a center crop for speed.
    const cx = Math.round(w * 0.35);
    const cy = Math.round(h * 0.35);
    const cw = Math.round(w * 0.3);
    const ch = Math.round(h * 0.3);
    let sum = 0;
    let count = 0;
    let bright = 0;
    try {
      const region = ctx.getImageData(cx, cy, cw, ch);
      for (let i = 0; i < region.data.length; i += 4) {
        sum += region.data[i]; // red channel
        bright += region.data[i] + region.data[i + 1] + region.data[i + 2];
        count++;
      }
    } catch {
      return null;
    }
    if (!count) return null;
    const brightness = bright / count / 3;
    const lightingScore = brightness > 90 ? 0.85 : 0.3;
    return {
      greenMean: sum / count,
      timestampMs: performance.now(),
      faceStability: 0.8,
      motionScore: 0.9,
      lightingScore,
      leftRightConsistency: 0.8,
    };
  }

  release(): void {
    // no landmarker to close
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