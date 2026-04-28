import { SAFETY_SYSTEM_PROMPT, VISIBLE_CONCERN_PROMPT } from "@/lib/ai/prompts";
import { runStructuredResponse } from "@/lib/ai/openaiClient";
import { visibleConcernSchema } from "@/lib/ai/schemas";
import { translate, type Language } from "@/lib/i18n";

export async function explainVisibleConcernFromImage(input: {
  language: Language;
  base64DataUrl: string;
}) {
  return runStructuredResponse({
    mode: "vision",
    schema: visibleConcernSchema,
    schemaName: "visible_concern",
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
            text: VISIBLE_CONCERN_PROMPT,
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
            text:
              "Explain only broad visible concerns. Do not diagnose. If unclear, say manual review is needed.",
          },
          {
            type: "input_image",
            image_url: input.base64DataUrl,
          },
        ],
      },
    ],
  });
}
