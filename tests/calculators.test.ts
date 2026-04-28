import { describe, expect, it } from "vitest";
import { calculateBMI } from "@/lib/calculators/bmi";
import { calculateBpRisk } from "@/lib/calculators/bpRisk";
import { calculateDiabetesRiskScore } from "@/lib/calculators/diabetesRisk";
import { calculateWaistRisk } from "@/lib/calculators/waistRisk";

describe("core calculators", () => {
  it("calculates BMI with Indian cutoffs", () => {
    const result = calculateBMI(70, 170);

    expect(result.bmi).toBe(24.2);
    expect(result.category).toBe("overweight");
    expect(result.categoryKey).toBe("bmi.overweight");
  });

  it("flags male waist above the Indian risk cutoff", () => {
    const result = calculateWaistRisk("male", 95);

    expect(result.increasedRisk).toBe(true);
    expect(result.thresholdCm).toBe(90);
  });

  it("scores IDRS-style risk correctly", () => {
    const result = calculateDiabetesRiskScore({
      age: 52,
      gender: "female",
      waistCm: 92,
      physicalActivity: "sedentary",
      familyHistory: "both_parents",
    });

    expect(result.score).toBe(100);
    expect(result.category).toBe("high");
    expect(result.breakdown).toEqual({
      age: 30,
      waist: 20,
      physicalActivity: 30,
      familyHistory: 20,
    });
  });

  it("detects urgent blood pressure readings", () => {
    const result = calculateBpRisk(185, 125);

    expect(result.status).toBe("urgent");
    expect(result.labelKey).toBe("bp.urgent");
  });
});
