import type { VitalScanConfidenceInputs, VitalScanResult } from "@/modules/unone-health/core/types";

/**
 * rPPG confidence is computed ENTIRELY from local signal quality — never from
 * OpenAI. The weights match the Swasthyak spec exactly:
 *
 *   25% face/ROI stability
 *   20% motion score            (1 = perfectly still)
 *   15% lighting score
 *   25% signal quality
 *   15% left/right ROI consistency
 *
 * Thresholds:
 *   >= 0.80        good      -> show result
 *   0.60 .. 0.79   moderate  -> show result with caution
 *   0.40 .. 0.59   low       -> ask repeat scan
 *   <  0.40        fail      -> do not show HR/RR
 */
export function computeConfidence(
  inputs: VitalScanConfidenceInputs,
): number {
  const clamped = (value: number) => Math.max(0, Math.min(1, value));
  const score =
    0.25 * clamped(inputs.faceRoiStability) +
    0.2 * clamped(inputs.motionScore) +
    0.15 * clamped(inputs.lightingScore) +
    0.25 * clamped(inputs.signalQuality) +
    0.15 * clamped(inputs.leftRightRoiConsistency);
  return Math.round(score * 1000) / 1000;
}

export type ConfidenceLabel = "good" | "moderate" | "low" | "fail";

export function labelForConfidence(confidence: number): ConfidenceLabel {
  if (confidence >= 0.8) return "good";
  if (confidence >= 0.6) return "moderate";
  if (confidence >= 0.4) return "low";
  return "fail";
}

/**
 * Converts a raw 0..1 quality score into the coarse label used by the result
 * schema. Used for signal_quality and lighting_quality.
 */
export function qualityLabel(
  score: number,
): "good" | "acceptable" | "poor" | "unknown" {
  if (score >= 0.8) return "good";
  if (score >= 0.5) return "acceptable";
  if (score > 0) return "poor";
  return "unknown";
}

export function stabilityLabel(
  score: number,
): "stable" | "unstable" | "unknown" {
  if (score >= 0.6) return "stable";
  if (score > 0) return "unstable";
  return "unknown";
}

/**
 * Decide whether HR/RR may be shown and whether a repeat scan is recommended.
 * HR/RR are nulled on `fail`; repeat is recommended for anything below `good`.
 */
export function applyConfidencePolicy(result: VitalScanResult): VitalScanResult {
  if (result.confidence_label === "fail") {
    return {
      ...result,
      heart_rate_bpm: null,
      respiratory_rate_bpm: null,
      repeat_scan_recommended: true,
    };
  }
  if (result.confidence_label === "low") {
    return { ...result, repeat_scan_recommended: true };
  }
  return result;
}

/** Helper: map raw sub-scores into the full VitalScanResult confidence block. */
export function buildConfidenceBlock(inputs: VitalScanConfidenceInputs): {
  confidence: number;
  confidence_label: ConfidenceLabel;
  signal_quality: VitalScanResult["signal_quality"];
  lighting_quality: VitalScanResult["lighting_quality"];
  face_stability: VitalScanResult["face_stability"];
  motion_detected: boolean;
} {
  const confidence = computeConfidence(inputs);
  return {
    confidence,
    confidence_label: labelForConfidence(confidence),
    signal_quality: qualityLabel(inputs.signalQuality),
    lighting_quality: qualityLabel(inputs.lightingScore),
    face_stability: stabilityLabel(inputs.faceRoiStability),
    motion_detected: inputs.motionScore < 0.5,
  };
}