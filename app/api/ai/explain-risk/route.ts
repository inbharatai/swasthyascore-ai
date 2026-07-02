import { NextResponse } from "next/server";
import { z } from "zod";
import { generateRiskExplanation } from "@/lib/ai/RiskExplanationAgent";
import { riskExplanationApiSchema } from "@/lib/ai/schemas";
import { translate } from "@/lib/i18n";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const explainRiskRequestSchema = z.object({
  language: z.enum(["en", "hi"]),
  patientValues: z.any(),
  screeningResult: z.any(),
});

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = explainRiskRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid explanation request." },
      { status: 400 },
    );
  }

  const { language } = parsed.data;

  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: translate(language, "validation.aiUnavailableWithoutApiKey") },
        { status: 503 },
      );
    }

    const explanation = await generateRiskExplanation(parsed.data);
    const apiShape = riskExplanationApiSchema.parse({
      summary: explanation.summary,
      simpleExplanation: explanation.simpleExplanation,
      topRiskFactors: explanation.topRiskFactors,
      nextSteps: explanation.recommendedNextSteps,
      referralNote: explanation.doctorReferralNote,
      lifestyleAdvice: explanation.lifestyleAdvice,
      safetyDisclaimer: explanation.safetyDisclaimer,
    });

    return NextResponse.json(apiShape, {
      headers: {
        "Cache-Control": "no-store",
      },
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
