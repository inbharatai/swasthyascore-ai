import { describe, expect, it } from "vitest";
import { estimateBodyRiskFromLandmarks } from "@/lib/camera/bodyRiskEstimate";
import { estimateHeightWithReference } from "@/lib/camera/heightEstimate";
import { evaluateVisibleRiskFallback } from "@/lib/camera/visibleRiskRules";

describe("camera safety rules", () => {
  it("does not estimate height without a reference marker", () => {
    const result = estimateHeightWithReference({
      referenceType: "none",
      referenceHeightCm: null,
      referencePixelHeight: 200,
      bodyPixelHeight: 1200,
      poseConfidence: "high",
    });

    expect(result.estimatedHeightCm).toBeNull();
    expect(result.requiresManualConfirmation).toBe(true);
    expect(result.confidence).toBe("low");
  });

  it("estimates height only as a manually confirmed value with a reference", () => {
    const result = estimateHeightWithReference({
      referenceType: "one_meter_strip",
      referenceHeightCm: 100,
      referencePixelHeight: 700,
      bodyPixelHeight: 1190,
      poseConfidence: "high",
    });

    expect(result.estimatedHeightCm).toBe(170);
    expect(result.requiresManualConfirmation).toBe(true);
    expect(result.confidence).toBe("medium");
  });

  it("returns qualitative body-risk guidance, not weight or BMI", () => {
    const result = estimateBodyRiskFromLandmarks({
      fullBodyVisible: true,
      shoulderWidthPx: 220,
      hipWidthPx: 200,
      waistWidthPx: 190,
      poseConfidence: "high",
    });

    expect(result.category).toBe("possible_central_obesity_risk");
    expect(result.requiresManualConfirmation).toBe(true);
    expect(result.warnings.join(" ")).toContain("Confirm with waist");
  });

  it("visible-risk fallback stays non-diagnostic", () => {
    const result = evaluateVisibleRiskFallback({
      fullBodyVisible: false,
      hasFootImage: true,
      hasWalkingVideo: false,
      userReportedVisibleConcern: true,
      cameraAvailable: true,
    });

    expect(result.notDiagnosis).toBe(true);
    expect(result.category).toBe("foot_wound_concern");
    expect(result.recommendedActionKeys).toContain("next.doctorSoon");
  });
});
