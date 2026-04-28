import type { Language, TranslationKey } from "@/lib/i18n";

export type Gender = "male" | "female";
export type PhysicalActivity =
  | "regular_active"
  | "moderate"
  | "sedentary";
export type FamilyHistory = "none" | "one_parent" | "both_parents";
export type Symptom =
  | "frequent_urination"
  | "excessive_thirst"
  | "unexplained_weight_loss"
  | "blurred_vision"
  | "fatigue"
  | "slow_wound_healing"
  | "none";

export type RiskLevel = "LOW" | "MODERATE" | "HIGH" | "URGENT";

export interface HealthFormData {
  name: string;
  age: string;
  gender: Gender | "";
  heightCm: string;
  weightKg: string;
  waistCm: string;
  systolicBp: string;
  diastolicBp: string;
  physicalActivity: PhysicalActivity | "";
  familyHistory: FamilyHistory | "";
  symptoms: Symptom[];
  notes: string;
  hba1c: string;
  fastingGlucose: string;
  randomGlucose: string;
}

export type HealthFormChangeHandler = <K extends keyof HealthFormData>(
  field: K,
  value: HealthFormData[K],
) => void;

export interface NormalizedHealthInput {
  name?: string;
  age: number;
  gender: Gender;
  heightCm: number;
  weightKg: number;
  waistCm: number;
  systolicBp: number | null;
  diastolicBp: number | null;
  physicalActivity: PhysicalActivity;
  familyHistory: FamilyHistory;
  symptoms: Symptom[];
  notes?: string;
  hba1c: number | null;
  fastingGlucose: number | null;
  randomGlucose: number | null;
}

export interface ValidationResult {
  isValid: boolean;
  fieldErrors: Partial<Record<keyof HealthFormData, TranslationKey>>;
}

export interface BMIResult {
  bmi: number;
  category: "underweight" | "normal" | "overweight" | "obesity";
  categoryKey: TranslationKey;
  noteKey: TranslationKey;
}

export interface WaistRiskResult {
  increasedRisk: boolean;
  thresholdCm: number;
  messageKey: TranslationKey;
  noteKey: TranslationKey;
}

export interface DiabetesRiskResult {
  score: number;
  category: "low" | "moderate" | "high";
  categoryKey: TranslationKey;
  breakdown: {
    age: number;
    waist: number;
    physicalActivity: number;
    familyHistory: number;
  };
  noteKey: TranslationKey;
}

export type LabStatus =
  | "normal"
  | "prediabetes"
  | "diabetes"
  | "cautious";

export interface LabValueInterpretation {
  name: "hba1c" | "fastingGlucose" | "randomGlucose";
  value: number;
  status: LabStatus;
  labelKey: TranslationKey;
}

export interface LabInterpretationResult {
  entries: LabValueInterpretation[];
  summaryKey: TranslationKey;
  noteKey: TranslationKey;
  hasAnyValue: boolean;
  hasPrediabetesRangeValue: boolean;
  hasDiabetesRangeValue: boolean;
}

export interface BpRiskResult {
  status: "unknown" | "normal" | "elevated" | "high" | "urgent";
  labelKey: TranslationKey;
  noteKey: TranslationKey;
  incompleteReading: boolean;
}

export interface OverallRiskResult {
  riskLevel: RiskLevel;
  riskKey: TranslationKey;
  reasonKeys: TranslationKey[];
  nextStepKeys: TranslationKey[];
  doctorReferralNeeded: boolean;
  labTestingRecommended: boolean;
  emergencyWarning: boolean;
}

export interface ScreeningResult {
  bmi: BMIResult;
  waistRisk: WaistRiskResult;
  diabetesRisk: DiabetesRiskResult;
  bpRisk: BpRiskResult;
  labInterpretation: LabInterpretationResult;
  overallRisk: OverallRiskResult;
}

export interface LabOcrResult {
  hba1c: number | null;
  fastingGlucose: number | null;
  randomGlucose: number | null;
  systolicBp: number | null;
  diastolicBp: number | null;
  confidence: "low" | "medium" | "high";
  warnings: string[];
}

export interface AiExplanationResult {
  summary: string;
  simpleExplanation: string;
  topRiskFactors: string[];
  recommendedNextSteps: string[];
  doctorReferralNote: string;
  lifestyleAdvice: string[];
  safetyDisclaimer: string;
}

export interface TranslationRequest {
  language: Language;
  text: string;
}

export interface PatientProfile {
  id: string;
  fullName: string;
  preferredLanguage: Language;
  ageYears: number;
  gender: Gender;
}

export interface ScreeningRecord {
  id: string;
  patientId: string;
  createdAtIso: string;
  input: NormalizedHealthInput;
  result: ScreeningResult;
}

export interface LabReport {
  id: string;
  screeningRecordId: string;
  source: "manual" | "ocr";
  extractedValues: LabOcrResult;
}

export interface ReferralNoteRecord {
  id: string;
  screeningRecordId: string;
  note: string;
}

export type UserRole = "patient" | "field_worker" | "clinic_admin" | "doctor";

export const EMPTY_HEALTH_FORM: HealthFormData = {
  name: "",
  age: "",
  gender: "",
  heightCm: "",
  weightKg: "",
  waistCm: "",
  systolicBp: "",
  diastolicBp: "",
  physicalActivity: "",
  familyHistory: "",
  symptoms: ["none"],
  notes: "",
  hba1c: "",
  fastingGlucose: "",
  randomGlucose: "",
};
