import type {
  BodyRiskEstimateInput,
  BodyRiskEstimateResult,
} from "@/lib/types/camera";

export function estimateBodyRiskFromLandmarks(
  input: BodyRiskEstimateInput,
): BodyRiskEstimateResult {
  if (!input.fullBodyVisible) {
    return {
      category: "unclear_manual_needed",
      confidence: "low",
      warnings: ["Full body is not visible. Please use manual height, weight, and waist measurements."],
      requiresManualConfirmation: true,
    };
  }

  if (!input.shoulderWidthPx || !input.hipWidthPx || !input.waistWidthPx) {
    return {
      category: "unclear_manual_needed",
      confidence: "low",
      warnings: ["Body landmarks were not clear enough for visual guidance."],
      requiresManualConfirmation: true,
    };
  }

  const waistToHipRatio = input.waistWidthPx / input.hipWidthPx;
  const shoulderToHipRatio = input.shoulderWidthPx / input.hipWidthPx;

  if (waistToHipRatio >= 0.92) {
    return {
      category: "possible_central_obesity_risk",
      confidence: input.poseConfidence === "high" ? "medium" : "low",
      warnings: [
        "This is only a visual risk sign. Confirm with waist circumference in centimeters.",
      ],
      requiresManualConfirmation: true,
    };
  }

  if (waistToHipRatio >= 0.82 || shoulderToHipRatio > 1.45) {
    return {
      category: "possible_overweight_risk",
      confidence: "low",
      warnings: [
        "Do not estimate BMI from image alone. Confirm using height and weight.",
      ],
      requiresManualConfirmation: true,
    };
  }

  if (waistToHipRatio < 0.55) {
    return {
      category: "possible_undernutrition_risk",
      confidence: "low",
      warnings: [
        "Visual appearance can be misleading. Confirm with weight, diet history, and clinical review.",
      ],
      requiresManualConfirmation: true,
    };
  }

  return {
    category: "possible_normal_body_size",
    confidence: "low",
    warnings: ["Please confirm with weight, height, and waist measurement."],
    requiresManualConfirmation: true,
  };
}
