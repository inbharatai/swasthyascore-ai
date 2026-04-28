import type {
  HeightEstimateInput,
  HeightEstimateResult,
} from "@/lib/types/camera";

function confidenceRank(value: HeightEstimateInput["poseConfidence"]) {
  if (value === "high") return 3;
  if (value === "medium") return 2;
  return 1;
}

export function estimateHeightWithReference(
  input: HeightEstimateInput,
): HeightEstimateResult {
  const warnings: string[] = [];

  if (input.referenceType === "none" || input.referenceHeightCm == null) {
    return {
      estimatedHeightCm: null,
      confidence: "low",
      warnings: [
        "Height cannot be reliably estimated without a reference marker. Please enter height manually.",
      ],
      requiresManualConfirmation: true,
    };
  }

  if (!input.referencePixelHeight || input.referencePixelHeight <= 0) {
    warnings.push("Reference marker height was not detected clearly.");
  }

  if (!input.bodyPixelHeight || input.bodyPixelHeight <= 0) {
    warnings.push("Full body height was not detected clearly.");
  }

  if (warnings.length > 0) {
    return {
      estimatedHeightCm: null,
      confidence: "low",
      warnings,
      requiresManualConfirmation: true,
    };
  }

  const referencePixelHeight = input.referencePixelHeight;
  const bodyPixelHeight = input.bodyPixelHeight;
  if (referencePixelHeight == null || bodyPixelHeight == null) {
    return {
      estimatedHeightCm: null,
      confidence: "low",
      warnings: ["Camera measurements were incomplete."],
      requiresManualConfirmation: true,
    };
  }

  const estimatedHeightCm =
    (bodyPixelHeight / referencePixelHeight) * input.referenceHeightCm;
  const roundedHeight = Math.round(estimatedHeightCm);
  const plausible = roundedHeight >= 90 && roundedHeight <= 230;

  if (!plausible) {
    warnings.push("Estimated height is outside a realistic adult range.");
  }

  const confidence =
    plausible && confidenceRank(input.poseConfidence) >= 3
      ? "medium"
      : plausible
        ? "low"
        : "low";

  return {
    estimatedHeightCm: plausible ? roundedHeight : null,
    confidence,
    warnings,
    requiresManualConfirmation: true,
  };
}
