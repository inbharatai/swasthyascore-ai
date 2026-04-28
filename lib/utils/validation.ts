import type {
  HealthFormData,
  NormalizedHealthInput,
  Symptom,
  ValidationResult,
} from "@/lib/types/health";

function parseOptionalNumber(value: string): number | null {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseRequiredNumber(value: string): number {
  return Number(value);
}

function normalizeSymptoms(symptoms: Symptom[]): Symptom[] {
  const uniqueSymptoms = [...new Set(symptoms)];
  if (uniqueSymptoms.includes("none")) {
    return uniqueSymptoms.length === 1
      ? ["none"]
      : uniqueSymptoms.filter((symptom) => symptom !== "none");
  }

  return uniqueSymptoms.length > 0 ? uniqueSymptoms : ["none"];
}

export function validateHealthForm(data: HealthFormData): ValidationResult {
  const fieldErrors: ValidationResult["fieldErrors"] = {};

  const age = parseOptionalNumber(data.age);
  if (age == null) {
    fieldErrors.age = "validation.ageRequired";
  } else if (age < 18 || age > 120) {
    fieldErrors.age = "validation.ageRange";
  }

  if (!data.gender) {
    fieldErrors.gender = "validation.genderRequired";
  }

  const heightCm = parseOptionalNumber(data.heightCm);
  if (heightCm == null) {
    fieldErrors.heightCm = "validation.heightRequired";
  } else if (heightCm < 50 || heightCm > 250) {
    fieldErrors.heightCm = "validation.heightRange";
  }

  const weightKg = parseOptionalNumber(data.weightKg);
  if (weightKg == null) {
    fieldErrors.weightKg = "validation.weightRequired";
  } else if (weightKg < 20 || weightKg > 350) {
    fieldErrors.weightKg = "validation.weightRange";
  }

  const waistCm = parseOptionalNumber(data.waistCm);
  if (waistCm == null) {
    fieldErrors.waistCm = "validation.waistRequired";
  } else if (waistCm < 40 || waistCm > 200) {
    fieldErrors.waistCm = "validation.waistRange";
  }

  if (!data.physicalActivity) {
    fieldErrors.physicalActivity = "validation.activityRequired";
  }

  if (!data.familyHistory) {
    fieldErrors.familyHistory = "validation.familyHistoryRequired";
  }

  const systolic = parseOptionalNumber(data.systolicBp);
  if (systolic != null && (systolic < 70 || systolic > 250)) {
    fieldErrors.systolicBp = "validation.systolicRange";
  }

  const diastolic = parseOptionalNumber(data.diastolicBp);
  if (diastolic != null && (diastolic < 40 || diastolic > 150)) {
    fieldErrors.diastolicBp = "validation.diastolicRange";
  }

  const hba1c = parseOptionalNumber(data.hba1c);
  if (hba1c != null && (hba1c < 3 || hba1c > 20)) {
    fieldErrors.hba1c = "validation.hba1cRange";
  }

  const fastingGlucose = parseOptionalNumber(data.fastingGlucose);
  if (fastingGlucose != null && (fastingGlucose < 40 || fastingGlucose > 500)) {
    fieldErrors.fastingGlucose = "validation.fastingRange";
  }

  const randomGlucose = parseOptionalNumber(data.randomGlucose);
  if (randomGlucose != null && (randomGlucose < 40 || randomGlucose > 600)) {
    fieldErrors.randomGlucose = "validation.randomRange";
  }

  return {
    isValid: Object.keys(fieldErrors).length === 0,
    fieldErrors,
  };
}

export function normalizeHealthForm(data: HealthFormData): NormalizedHealthInput {
  return {
    name: data.name.trim() || undefined,
    age: parseRequiredNumber(data.age),
    gender: data.gender as NormalizedHealthInput["gender"],
    heightCm: parseRequiredNumber(data.heightCm),
    weightKg: parseRequiredNumber(data.weightKg),
    waistCm: parseRequiredNumber(data.waistCm),
    systolicBp: parseOptionalNumber(data.systolicBp),
    diastolicBp: parseOptionalNumber(data.diastolicBp),
    physicalActivity:
      data.physicalActivity as NormalizedHealthInput["physicalActivity"],
    familyHistory: data.familyHistory as NormalizedHealthInput["familyHistory"],
    symptoms: normalizeSymptoms(data.symptoms),
    notes: data.notes.trim() || undefined,
    hba1c: parseOptionalNumber(data.hba1c),
    fastingGlucose: parseOptionalNumber(data.fastingGlucose),
    randomGlucose: parseOptionalNumber(data.randomGlucose),
  };
}
