import { RISK_EXPLANATION_PROMPT, SAFETY_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { riskExplanationSchema } from "@/lib/ai/schemas";
import { runStructuredResponse } from "@/lib/ai/openaiClient";
import { reviewExplanationSafety } from "@/lib/ai/SafetyReviewAgent";
import { generateReferralNote } from "@/lib/ai/ReferralNoteAgent";
import { translate, type Language } from "@/lib/i18n";
import type { NormalizedHealthInput, ScreeningResult } from "@/lib/types/health";

export async function generateRiskExplanation(input: {
  language: Language;
  patientValues: NormalizedHealthInput;
  screeningResult: ScreeningResult;
}) {
  const baseExplanation = await runStructuredResponse({
    mode: "default",
    schema: riskExplanationSchema,
    schemaName: "risk_explanation",
    responseInput: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text: SAFETY_SYSTEM_PROMPT,
          },
          {
            type: "input_text",
            text: RISK_EXPLANATION_PROMPT,
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: `Selected language: ${
              input.language === "hi"
                ? translate("hi", "common.hindi")
                : translate("en", "common.english")
            }`,
          },
          {
            type: "input_text",
            text: "Use the deterministic screening result below as the source of truth.",
          },
          {
            type: "input_text",
            text: JSON.stringify({
              patientValues: input.patientValues,
              screeningResult: input.screeningResult,
            }),
          },
        ],
      },
    ],
  });

  let doctorReferralNote = baseExplanation.doctorReferralNote;

  if (input.screeningResult.overallRisk.doctorReferralNeeded) {
    const referralNote = await generateReferralNote(input);
    doctorReferralNote = referralNote.note;
  }

  return reviewExplanationSafety(input.language, {
    ...baseExplanation,
    doctorReferralNote,
  });
}
