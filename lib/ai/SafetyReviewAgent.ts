import { translate, type Language } from "@/lib/i18n";
import type { AiExplanationResult } from "@/lib/types/health";

function stripUnsafeMedicalClaims(text: string, language: Language): string {
  let sanitized = text;

  sanitized = sanitized.replace(
    /\byou have diabetes\b/gi,
    language === "hi"
      ? "आपके मान डायबिटीज़-रेंज में हैं और डॉक्टर से पुष्टि ज़रूरी है"
      : "Your values are in the diabetes-range and need doctor confirmation",
  );

  sanitized = sanitized.replace(
    /\byou are diabetic\b/gi,
    language === "hi"
      ? "डॉक्टर से पुष्टि ज़रूरी है"
      : "Doctor confirmation is required",
  );

  sanitized = sanitized.replace(
    /\b(start|take|begin)\b[^.]*\b\d+\s?(mg|mcg|ml)\b[^.]*/gi,
    language === "hi"
      ? "दवा के बारे में डॉक्टर से सलाह लें"
      : "Please ask a qualified doctor about treatment decisions",
  );

  return sanitized.trim();
}

export function reviewExplanationSafety(
  language: Language,
  explanation: AiExplanationResult,
): AiExplanationResult {
  return {
    ...explanation,
    summary: stripUnsafeMedicalClaims(explanation.summary, language),
    simpleExplanation: stripUnsafeMedicalClaims(
      explanation.simpleExplanation,
      language,
    ),
    doctorReferralNote: stripUnsafeMedicalClaims(
      explanation.doctorReferralNote,
      language,
    ),
    lifestyleAdvice: explanation.lifestyleAdvice.map((item) =>
      stripUnsafeMedicalClaims(item, language),
    ),
    recommendedNextSteps: explanation.recommendedNextSteps.map((item) =>
      stripUnsafeMedicalClaims(item, language),
    ),
    topRiskFactors: explanation.topRiskFactors.map((item) =>
      stripUnsafeMedicalClaims(item, language),
    ),
    safetyDisclaimer:
      stripUnsafeMedicalClaims(explanation.safetyDisclaimer, language) ||
      translate(language, "disclaimer.screeningOnly"),
  };
}
