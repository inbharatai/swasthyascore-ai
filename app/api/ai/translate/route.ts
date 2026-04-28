import { NextResponse } from "next/server";
import { z } from "zod";
import { runStructuredResponse } from "@/lib/ai/openaiClient";
import { SAFETY_SYSTEM_PROMPT, TRANSLATE_PROMPT } from "@/lib/ai/prompts";
import { translationResponseSchema } from "@/lib/ai/schemas";
import { reviewExplanationSafety } from "@/lib/ai/SafetyReviewAgent";
import type { AiExplanationResult } from "@/lib/types/health";
import { translate } from "@/lib/i18n";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const translateRequestSchema = z.object({
  language: z.enum(["en", "hi"]),
  text: z.string().min(1),
});

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = translateRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid translation request." }, { status: 400 });
  }

  const { language, text } = parsed.data;

  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        {
          error: translate(language, "validation.aiUnavailableWithoutApiKey"),
        },
        { status: 503 },
      );
    }

    const response = await runStructuredResponse({
      mode: "default",
      schema: translationResponseSchema,
      schemaName: "translation_response",
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
              text: TRANSLATE_PROMPT,
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Target language: ${language}`,
            },
            {
              type: "input_text",
              text,
            },
          ],
        },
      ],
    });

    const safe = reviewExplanationSafety(language, {
      summary: response.translatedText,
      simpleExplanation: response.translatedText,
      topRiskFactors: [],
      recommendedNextSteps: [],
      doctorReferralNote: "",
      lifestyleAdvice: [],
      safetyDisclaimer: response.safetyDisclaimer,
    } satisfies AiExplanationResult);

    return NextResponse.json({
      translatedText: safe.summary,
      safetyDisclaimer: safe.safetyDisclaimer,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : translate(language, "ai.explainFailure"),
      },
      { status: 500 },
    );
  }
}
