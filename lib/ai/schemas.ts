import { z } from "zod";

export const labOcrResponseSchema = z.object({
  hba1c: z.number().nullable(),
  fastingGlucose: z.number().nullable(),
  randomGlucose: z.number().nullable(),
  systolicBp: z.number().nullable(),
  diastolicBp: z.number().nullable(),
  confidence: z.enum(["low", "medium", "high"]),
  warnings: z.array(z.string()),
});

export const riskExplanationSchema = z.object({
  summary: z.string(),
  simpleExplanation: z.string(),
  topRiskFactors: z.array(z.string()),
  recommendedNextSteps: z.array(z.string()),
  doctorReferralNote: z.string(),
  lifestyleAdvice: z.array(z.string()),
  safetyDisclaimer: z.string(),
});

export const riskExplanationApiSchema = z.object({
  summary: z.string(),
  simpleExplanation: z.string(),
  topRiskFactors: z.array(z.string()),
  nextSteps: z.array(z.string()),
  referralNote: z.string(),
  lifestyleAdvice: z.array(z.string()),
  safetyDisclaimer: z.string(),
});

export const referralNoteSchema = z.object({
  note: z.string(),
});

export const visibleConcernSchema = z.object({
  summary: z.string(),
  visibleConcerns: z.array(z.string()),
  confidence: z.enum(["low", "medium", "high"]),
  recommendedAction: z.array(z.string()),
  safetyDisclaimer: z.string(),
  notDiagnosis: z.literal(true),
});

export const translationResponseSchema = z.object({
  translatedText: z.string(),
  safetyDisclaimer: z.string(),
});
