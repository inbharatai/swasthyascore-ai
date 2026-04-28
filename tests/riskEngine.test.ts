import { describe, expect, it } from "vitest";
import { calculateScreeningResult } from "@/lib/calculators/overallRisk";
import type { NormalizedHealthInput } from "@/lib/types/health";

const baseInput: NormalizedHealthInput = {
  name: "Test User",
  age: 30,
  gender: "male",
  heightCm: 170,
  weightKg: 62,
  waistCm: 84,
  systolicBp: 118,
  diastolicBp: 76,
  physicalActivity: "regular_active",
  familyHistory: "none",
  symptoms: ["none"],
  notes: "",
  hba1c: null,
  fastingGlucose: null,
  randomGlucose: null,
};

describe("overall risk engine", () => {
  it("keeps a healthy case in the low-risk bucket", () => {
    const result = calculateScreeningResult(baseInput);

    expect(result.overallRisk.riskLevel).toBe("LOW");
    expect(result.overallRisk.emergencyWarning).toBe(false);
  });

  it("pushes diabetes-range HbA1c into high risk with doctor referral", () => {
    const result = calculateScreeningResult({
      ...baseInput,
      hba1c: 6.8,
    });

    expect(result.overallRisk.riskLevel).toBe("HIGH");
    expect(result.overallRisk.doctorReferralNeeded).toBe(true);
  });

  it("marks random glucose 220 with symptoms as urgent", () => {
    const result = calculateScreeningResult({
      ...baseInput,
      randomGlucose: 220,
      symptoms: ["frequent_urination", "excessive_thirst"],
    });

    expect(result.overallRisk.riskLevel).toBe("URGENT");
    expect(result.overallRisk.emergencyWarning).toBe(true);
  });

  it("marks BP 185/125 as urgent", () => {
    const result = calculateScreeningResult({
      ...baseInput,
      systolicBp: 185,
      diastolicBp: 125,
    });

    expect(result.overallRisk.riskLevel).toBe("URGENT");
    expect(result.overallRisk.reasonKeys).toContain("reason.bp.urgent");
  });

  it("recommends lab testing for high score with obesity and waist risk", () => {
    const result = calculateScreeningResult({
      ...baseInput,
      age: 54,
      weightKg: 85,
      waistCm: 103,
      physicalActivity: "sedentary",
      familyHistory: "both_parents",
    });

    expect(result.diabetesRisk.category).toBe("high");
    expect(result.overallRisk.labTestingRecommended).toBe(true);
    expect(result.overallRisk.nextStepKeys).toContain("next.labTest");
  });
});
