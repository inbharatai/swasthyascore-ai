import type { CameraConfidence, PoseAnalysisResult } from "@/lib/types/camera";

export type PoseWarningKey =
  | "capture.warning.noHead"
  | "capture.warning.noHeel"
  | "capture.warning.noFullBody"
  | "capture.warning.tilted"
  | "capture.warning.tooClose"
  | "capture.warning.tooFar"
  | "capture.warning.poorPosture"
  | "capture.warning.lowLight";

export interface PoseQualityResult {
  confidence: CameraConfidence;
  warnings: PoseWarningKey[];
  qualityScore: number; // 0–100
  headVisible: boolean;
  heelVisible: boolean;
  fullBodyVisible: boolean;
  bodySpanFraction: number; // body height as fraction of frame
}

// MediaPipe Pose landmark indices:
// 0 = nose, 1/2 = eyes, 3/4 = ears, 7/8 = mouth corners
// 11/12 = shoulders, 13/14 = elbows, 15/16 = wrists
// 23/24 = hips, 25/26 = knees, 27/28 = ankles, 29/30 = heels, 31/32 = foot index

function landmarkVisible(
  landmarks: PoseAnalysisResult["landmarks"],
  index: number,
  threshold = 0.35,
): boolean {
  const lm = landmarks[index];
  return lm != null && (lm.visibility ?? 0.5) >= threshold;
}

export function evaluatePoseQuality(
  analysis: PoseAnalysisResult | null,
  videoWidth: number,
  videoHeight: number,
): PoseQualityResult {
  void videoHeight;

  if (!analysis || analysis.landmarks.length === 0) {
    return {
      confidence: "low",
      warnings: ["capture.warning.noFullBody"],
      qualityScore: 0,
      headVisible: false,
      heelVisible: false,
      fullBodyVisible: false,
      bodySpanFraction: 0,
    };
  }

  const lm = analysis.landmarks;
  const warnings: PoseWarningKey[] = [];

  // Head visibility: nose (0) or any ear (3, 4) present
  const headVisible =
    landmarkVisible(lm, 0) || landmarkVisible(lm, 3) || landmarkVisible(lm, 4);

  // Heel/foot visibility: ankles (27, 28), heels (29, 30), or foot index (31, 32)
  const heelVisible =
    landmarkVisible(lm, 27) ||
    landmarkVisible(lm, 28) ||
    landmarkVisible(lm, 29) ||
    landmarkVisible(lm, 30);

  if (!headVisible) warnings.push("capture.warning.noHead");
  if (!heelVisible) warnings.push("capture.warning.noHeel");

  // Full body span check: nose Y near top, heel/ankle Y near bottom
  const noseY = lm[0]?.y ?? null;
  const leftAnkleY = lm[27]?.y ?? null;
  const rightAnkleY = lm[28]?.y ?? null;
  const heelY = leftAnkleY != null && rightAnkleY != null
    ? Math.max(leftAnkleY, rightAnkleY)
    : leftAnkleY ?? rightAnkleY;

  const bodySpanFraction = noseY != null && heelY != null ? heelY - noseY : 0;
  const fullBodyVisible = headVisible && heelVisible && bodySpanFraction > 0.35;

  if (!fullBodyVisible && headVisible && heelVisible) {
    warnings.push("capture.warning.noFullBody");
  }

  // Distance check based on body span fraction in frame
  if (bodySpanFraction > 0.95) {
    warnings.push("capture.warning.tooClose");
  } else if (bodySpanFraction > 0 && bodySpanFraction < 0.35) {
    warnings.push("capture.warning.tooFar");
  }

  // Camera tilt: check shoulder slope
  const leftShoulder = lm[11];
  const rightShoulder = lm[12];
  if (leftShoulder && rightShoulder) {
    const shoulderDeltaY = Math.abs(leftShoulder.y - rightShoulder.y);
    const shoulderDeltaX = Math.abs(leftShoulder.x - rightShoulder.x);
    // If shoulder vertical difference is more than 10% of horizontal span → tilted
    if (shoulderDeltaX > 0.05 && shoulderDeltaY / shoulderDeltaX > 0.1) {
      warnings.push("capture.warning.tilted");
    }
  }

  // Posture: nose should be roughly above hip midpoint (within 15% of frame width)
  const leftHip = lm[23];
  const rightHip = lm[24];
  const nose = lm[0];
  if (nose && leftHip && rightHip) {
    const hipMidX = (leftHip.x + rightHip.x) / 2;
    if (Math.abs(nose.x - hipMidX) > 0.15) {
      warnings.push("capture.warning.poorPosture");
    }
  }

  // Score calculation
  let score = 100;
  score -= warnings.length * 15;
  if (!fullBodyVisible) score -= 20;
  score = Math.max(0, score);

  // Confidence
  let confidence: CameraConfidence;
  if (warnings.length === 0 && fullBodyVisible && headVisible && heelVisible) {
    confidence = "high";
  } else if (warnings.length <= 1 && fullBodyVisible) {
    confidence = "medium";
  } else {
    confidence = "low";
  }

  void videoWidth; // unused but kept for API symmetry

  return {
    confidence,
    warnings,
    qualityScore: score,
    headVisible,
    heelVisible,
    fullBodyVisible,
    bodySpanFraction,
  };
}
