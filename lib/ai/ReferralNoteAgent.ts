import { REFERRAL_NOTE_PROMPT, SAFETY_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { runStructuredResponse } from "@/lib/ai/openaiClient";
import { referralNoteSchema } from "@/lib/ai/schemas";
import { translate, type Language } from "@/lib/i18n";
import type { NormalizedHealthInput, ScreeningResult } from "@/lib/types/health";

export async function generateReferralNote(input: {
  language: Language;
  patientValues: NormalizedHealthInput;
  screeningResult: ScreeningResult;
}) {
  return runStructuredResponse({
    mode: "default",
    schema: referralNoteSchema,
    schemaName: "referral_note",
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
            text: REFERRAL_NOTE_PROMPT,
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: `Language: ${
              input.language === "hi"
                ? translate("hi", "common.hindi")
                : translate("en", "common.english")
            }`,
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
}
