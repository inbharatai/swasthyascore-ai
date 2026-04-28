import type {
  DiabetesRiskResult,
  FamilyHistory,
  Gender,
  PhysicalActivity,
} from "@/lib/types/health";

function calculateAgeScore(age: number): number {
  if (age < 35) return 0;
  if (age <= 49) return 20;
  return 30;
}

function calculateWaistScore(gender: Gender, waistCm: number): number {
  if (gender === "male") {
    if (waistCm < 90) return 0;
    if (waistCm <= 99) return 10;
    return 20;
  }

  if (waistCm < 80) return 0;
  if (waistCm <= 89) return 10;
  return 20;
}

function calculatePhysicalActivityScore(activity: PhysicalActivity): number {
  if (activity === "regular_active") return 0;
  if (activity === "moderate") return 20;
  return 30;
}

function calculateFamilyHistoryScore(history: FamilyHistory): number {
  if (history === "none") return 0;
  if (history === "one_parent") return 10;
  return 20;
}

export function calculateDiabetesRiskScore(input: {
  age: number;
  gender: Gender;
  waistCm: number;
  physicalActivity: PhysicalActivity;
  familyHistory: FamilyHistory;
}): DiabetesRiskResult {
  const breakdown = {
    age: calculateAgeScore(input.age),
    waist: calculateWaistScore(input.gender, input.waistCm),
    physicalActivity: calculatePhysicalActivityScore(input.physicalActivity),
    familyHistory: calculateFamilyHistoryScore(input.familyHistory),
  };

  const score =
    breakdown.age +
    breakdown.waist +
    breakdown.physicalActivity +
    breakdown.familyHistory;

  if (score < 30) {
    return {
      score,
      category: "low",
      categoryKey: "idrs.low",
      breakdown,
      noteKey: "idrs.note",
    };
  }

  if (score <= 59) {
    return {
      score,
      category: "moderate",
      categoryKey: "idrs.moderate",
      breakdown,
      noteKey: "idrs.note",
    };
  }

  return {
    score,
    category: "high",
    categoryKey: "idrs.high",
    breakdown,
    noteKey: "idrs.note",
  };
}
