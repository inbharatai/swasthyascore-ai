import { LAB_OCR_PROMPT, SAFETY_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { labOcrResponseSchema } from "@/lib/ai/schemas";
import { runStructuredResponse } from "@/lib/ai/openaiClient";

export async function extractLabValuesFromImage(input: {
  mimeType: string;
  base64DataUrl: string;
}) {
  return runStructuredResponse({
    mode: "default",
    schema: labOcrResponseSchema,
    schemaName: "lab_ocr",
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
            text: LAB_OCR_PROMPT,
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text:
              "Extract only the visible lab values from this image. Return null when unclear.",
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
