import type {
  VisibleRiskRuleInput,
  VisibleRiskRuleResult,
} from "@/lib/types/camera";

export function evaluateVisibleRiskFallback(
  input: VisibleRiskRuleInput,
): VisibleRiskRuleResult {
  const warnings: string[] = [];

  if (!input.cameraAvailable) {
    return {
      category: "unclear",
      confidence: "low",
      warnings: ["Camera is unavailable. Use manual screening and ask for clinical review if there is a visible concern."],
      recommendedActionKeys: ["next.doctorSoon"],
      notDiagnosis: true,
    };
  }

  if (input.userReportedVisibleConcern) {
    return {
      category: input.hasFootImage
        ? "foot_wound_concern"
        : "mobility_or_posture_concern",
      confidence: "low",
      warnings: [
        "This is a visible concern only, not a diagnosis. A health worker or doctor should review it.",
      ],
      recommendedActionKeys: ["next.doctorSoon", "next.symptomReview"],
      notDiagnosis: true,
    };
  }

  if (!input.fullBodyVisible) {
    warnings.push("Camera view is incomplete. Manual screening is preferred.");
  }

  return {
    category: "unclear",
    confidence: "low",
    warnings:
      warnings.length > 0
        ? warnings
        : ["No clear visible concern was selected. Continue manual screening."],
    recommendedActionKeys: ["next.healthyHabits"],
    notDiagnosis: true,
  };
}
