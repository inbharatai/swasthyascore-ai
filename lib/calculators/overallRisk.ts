import { calculateBMI } from "@/lib/calculators/bmi";
import { calculateBpRisk } from "@/lib/calculators/bpRisk";
import { calculateDiabetesRiskScore } from "@/lib/calculators/diabetesRisk";
import { interpretLabValues } from "@/lib/calculators/labInterpretation";
import { calculateWaistRisk } from "@/lib/calculators/waistRisk";
import type { TranslationKey } from "@/lib/i18n";
import type {
  NormalizedHealthInput,
  RiskLevel,
  ScreeningResult,
} from "@/lib/types/health";

function riskWeight(level: RiskLevel): number {
  switch (level) {
    case "LOW":
      return 0;
    case "MODERATE":
      return 1;
    case "HIGH":
      return 2;
    case "URGENT":
      return 3;
  }
}

function elevateRisk(current: RiskLevel, candidate: RiskLevel): RiskLevel {
  return riskWeight(candidate) > riskWeight(current) ? candidate : current;
}

function keyForRiskLevel(level: RiskLevel): TranslationKey {
  switch (level) {
    case "LOW":
      return "overall.low";
    case "MODERATE":
      return "overall.moderate";
    case "HIGH":
      return "overall.high";
    case "URGENT":
      return "overall.urgent";
  }
}

export function calculateScreeningResult(
  input: NormalizedHealthInput,
): ScreeningResult {
  const bmi = calculateBMI(input.weightKg, input.heightCm);
  const waistRisk = calculateWaistRisk(input.gender, input.waistCm);
  const diabetesRisk = calculateDiabetesRiskScore({
    age: input.age,
    gender: input.gender,
    waistCm: input.waistCm,
    physicalActivity: input.physicalActivity,
    familyHistory: input.familyHistory,
  });
  const bpRisk = calculateBpRisk(input.systolicBp, input.diastolicBp);
  const labInterpretation = interpretLabValues({
    hba1c: input.hba1c,
    fastingGlucose: input.fastingGlucose,
    randomGlucose: input.randomGlucose,
  });

  const reasonKeys: TranslationKey[] = [];
  const nextStepKeys: TranslationKey[] = [];

  let riskLevel: RiskLevel = "LOW";
  let doctorReferralNeeded = false;
  let labTestingRecommended = false;
  let emergencyWarning = false;

  const selectedSymptoms = input.symptoms.filter((symptom) => symptom !== "none");

  if (bmi.category === "underweight") {
    reasonKeys.push("reason.underweight");
  }

  if (bmi.category === "overweight") {
    riskLevel = elevateRisk(riskLevel, "MODERATE");
    reasonKeys.push("reason.bmi.overweight");
    nextStepKeys.push("next.waistWeightPlan");
  }

  if (bmi.category === "obesity") {
    riskLevel = elevateRisk(riskLevel, "HIGH");
    reasonKeys.push("reason.bmi.obesity");
    nextStepKeys.push("next.waistWeightPlan");
    doctorReferralNeeded = true;
  }

  if (waistRisk.increasedRisk) {
    riskLevel = elevateRisk(riskLevel, "MODERATE");
    reasonKeys.push("reason.waist.increased");
    nextStepKeys.push("next.waistWeightPlan");
  }

  if (diabetesRisk.category === "moderate") {
    riskLevel = elevateRisk(riskLevel, "MODERATE");
    reasonKeys.push("reason.idrs.moderate");
    labTestingRecommended = true;
  }

  if (diabetesRisk.category === "high") {
    riskLevel = elevateRisk(riskLevel, "HIGH");
    reasonKeys.push("reason.idrs.high");
    labTestingRecommended = true;
    doctorReferralNeeded = true;
  }

  if (labInterpretation.hasPrediabetesRangeValue) {
    riskLevel = elevateRisk(riskLevel, "MODERATE");
    reasonKeys.push("reason.lab.prediabetes");
    nextStepKeys.push("next.repeatLab");
    doctorReferralNeeded = true;
  }

  if (labInterpretation.hasDiabetesRangeValue) {
    riskLevel = elevateRisk(riskLevel, "HIGH");
    reasonKeys.push("reason.lab.diabetes");
    nextStepKeys.push("next.repeatLab");
    doctorReferralNeeded = true;
  }

  if (bpRisk.status === "elevated") {
    riskLevel = elevateRisk(riskLevel, "MODERATE");
    reasonKeys.push("reason.bp.elevated");
    nextStepKeys.push("next.bpRepeat");
  }

  if (bpRisk.status === "high") {
    riskLevel = elevateRisk(riskLevel, "HIGH");
    reasonKeys.push("reason.bp.high");
    nextStepKeys.push("next.bpRepeat");
    doctorReferralNeeded = true;
  }

  if (bpRisk.status === "urgent") {
    riskLevel = elevateRisk(riskLevel, "URGENT");
    reasonKeys.push("reason.bp.urgent");
    nextStepKeys.push("next.urgentCare");
    doctorReferralNeeded = true;
    emergencyWarning = true;
  }

  if (selectedSymptoms.length > 0) {
    riskLevel = elevateRisk(riskLevel, "MODERATE");
    reasonKeys.push("reason.symptoms.present");
    nextStepKeys.push("next.symptomReview");
  }

  if (
    input.randomGlucose != null &&
    input.randomGlucose >= 200 &&
    selectedSymptoms.length > 0
  ) {
    riskLevel = elevateRisk(riskLevel, "URGENT");
    reasonKeys.push("reason.randomGlucoseSymptoms");
    nextStepKeys.push("next.urgentCare");
    doctorReferralNeeded = true;
    emergencyWarning = true;
  }

  if (
    diabetesRisk.category === "high" &&
    (bmi.category === "obesity" || waistRisk.increasedRisk)
  ) {
    labTestingRecommended = true;
    nextStepKeys.push("next.labTest");
  }

  if (labTestingRecommended) {
    nextStepKeys.push("next.labTest");
  }

  if (doctorReferralNeeded && !emergencyWarning) {
    nextStepKeys.push("next.doctorSoon");
  }

  if (riskLevel === "LOW") {
    nextStepKeys.push("next.healthyHabits", "next.trackMetrics");
  } else {
    nextStepKeys.push("next.activity", "next.trackMetrics");
  }

  const uniqueReasonKeys = [...new Set(reasonKeys)];
  const uniqueNextStepKeys = [...new Set(nextStepKeys)];

  return {
    bmi,
    waistRisk,
    diabetesRisk,
    bpRisk,
    labInterpretation,
    overallRisk: {
      riskLevel,
      riskKey: keyForRiskLevel(riskLevel),
      reasonKeys: uniqueReasonKeys,
      nextStepKeys: uniqueNextStepKeys,
      doctorReferralNeeded,
      labTestingRecommended,
      emergencyWarning,
    },
  };
}
