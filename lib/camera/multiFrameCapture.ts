import type { CameraConfidence } from "@/lib/types/camera";
import { analyzeVideoPose, estimateBodyPixelHeight } from "@/lib/camera/poseLandmarks";
import { evaluatePoseQuality } from "@/lib/camera/poseQualityEngine";

export interface MultiFrameHeightResult {
  estimatedHeightCm: number | null;
  rangeMinCm: number | null;
  rangeMaxCm: number | null;
  confidenceLevel: CameraConfidence;
  frameCount: number;
  validFrameCount: number;
  requiresManualConfirmation: boolean;
  warnings: string[];
}

interface FrameSample {
  bodySpanFraction: number;
  qualityScore: number;
}

/**
 * Remove outliers using the Interquartile Range (IQR) method.
 * Values below Q1 - 1.5*IQR or above Q3 + 1.5*IQR are excluded.
 */
function removeOutliers(values: number[]): number[] {
  if (values.length < 4) return values;
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)]!;
  const q3 = sorted[Math.floor(sorted.length * 0.75)]!;
  const iqr = q3 - q1;
  const lower = q1 - 1.5 * iqr;
  const upper = q3 + 1.5 * iqr;
  return sorted.filter((v) => v >= lower && v <= upper);
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}

/**
 * Captures pose data from a live video element over `durationMs` milliseconds,
 * collects body span fractions from quality frames, then converts to height cm
 * using a scale factor (pixels-per-cm or span-fraction-to-cm mapping).
 *
 * @param videoElement - Live <video> element with an active stream
 * @param durationMs - How long to capture (recommended: 2000–5000 ms)
 * @param referenceHeightCm - Height of the reference person to scale against (or null for AI-only)
 * @param referencePxHeight - Reference object pixel height (from marker engine, or null)
 * @param referenceRealCm - Reference object real height in cm (or null)
 * @param onProgress - Progress callback (0–1)
 */
export async function captureHeightFrames(
  videoElement: HTMLVideoElement,
  durationMs: number,
  onProgress: (pct: number) => void,
  referencePxHeight: number | null = null,
  referenceRealCm: number | null = null,
): Promise<MultiFrameHeightResult> {
  const TARGET_FPS = 15;
  const frameIntervalMs = 1000 / TARGET_FPS;
  const startTime = performance.now();
  const samples: FrameSample[] = [];
  const bodySpanFractions: number[] = [];
  const heightEstimatesCm: number[] = [];

  let frameCount = 0;

  while (performance.now() - startTime < durationMs) {
    const elapsed = performance.now() - startTime;
    onProgress(Math.min(elapsed / durationMs, 1));

    const analysis = await analyzeVideoPose(videoElement);
    frameCount++;

    const quality = evaluatePoseQuality(
      analysis,
      videoElement.videoWidth,
      videoElement.videoHeight,
    );

    if (quality.confidence !== "low" && quality.fullBodyVisible) {
      samples.push({
        bodySpanFraction: quality.bodySpanFraction,
        qualityScore: quality.qualityScore,
      });
      bodySpanFractions.push(quality.bodySpanFraction);

      // If we have a reference scale, compute real height per frame
      if (referencePxHeight != null && referenceRealCm != null) {
        const bodyPx = estimateBodyPixelHeight(analysis, videoElement.videoHeight);
        if (bodyPx != null && bodyPx > 0) {
          const estimatedCm = (bodyPx / referencePxHeight) * referenceRealCm;
          if (estimatedCm >= 90 && estimatedCm <= 230) {
            heightEstimatesCm.push(estimatedCm);
          }
        }
      }
    }

    // Wait for next frame interval
    const nextFrameTime = startTime + (frameCount * frameIntervalMs);
    const sleepMs = nextFrameTime - performance.now();
    if (sleepMs > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, sleepMs));
    }
  }

  onProgress(1);

  const validFrameCount = samples.length;

  // --- Case 1: Reference scale available → use heightEstimatesCm ---
  if (heightEstimatesCm.length >= 2) {
    const cleaned = removeOutliers(heightEstimatesCm);
    const med = median(cleaned);
    const roundedMedian = Math.round(med);
    const rangeMin = Math.round(Math.min(...cleaned));
    const rangeMax = Math.round(Math.max(...cleaned));
    const spread = rangeMax - rangeMin;

    const confidence: CameraConfidence =
      cleaned.length >= 5 && spread <= 4 ? "high" : spread <= 8 ? "medium" : "low";

    return {
      estimatedHeightCm: roundedMedian,
      rangeMinCm: rangeMin,
      rangeMaxCm: rangeMax,
      confidenceLevel: confidence,
      frameCount,
      validFrameCount,
      requiresManualConfirmation: confidence !== "high",
      warnings:
        confidence === "low"
          ? ["Approximate only. Please confirm height manually before health classification."]
          : [],
    };
  }

  // --- Case 2: No reference scale → AI-only estimate using body span ratio ---
  // Without scale we cannot give a real cm value. Return null height.
  if (validFrameCount === 0) {
    return {
      estimatedHeightCm: null,
      rangeMinCm: null,
      rangeMaxCm: null,
      confidenceLevel: "low",
      frameCount,
      validFrameCount: 0,
      requiresManualConfirmation: true,
      warnings: [
        "Full body was not clearly visible in enough frames. Please try again.",
      ],
    };
  }

  // With no marker, we cannot convert span fraction to cm reliably.
  // Return null height with medium confidence if frames were good.
  const cleanedSpans = removeOutliers(bodySpanFractions);
  const spanSpread = cleanedSpans.length > 1
    ? Math.max(...cleanedSpans) - Math.min(...cleanedSpans)
    : 1;

  return {
    estimatedHeightCm: null,
    rangeMinCm: null,
    rangeMaxCm: null,
    confidenceLevel: spanSpread < 0.05 && validFrameCount >= 5 ? "medium" : "low",
    frameCount,
    validFrameCount,
    requiresManualConfirmation: true,
    warnings: [
      "No reference marker found. Height cannot be estimated in centimeters without a scale reference. Please enter height manually.",
    ],
  };
}
