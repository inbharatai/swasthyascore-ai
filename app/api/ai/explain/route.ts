import { NextResponse } from "next/server";
import { z } from "zod";
import { generateRiskExplanation } from "@/lib/ai/RiskExplanationAgent";
import { translate } from "@/lib/i18n";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const explainRequestSchema = z.object({
  language: z.enum(["en", "hi"]),
  patientValues: z.object({
    name: z.string().optional(),
    age: z.number(),
    gender: z.enum(["male", "female"]),
    heightCm: z.number(),
    weightKg: z.number(),
    waistCm: z.number(),
    systolicBp: z.number().nullable(),
    diastolicBp: z.number().nullable(),
    physicalActivity: z.enum(["regular_active", "moderate", "sedentary"]),
    familyHistory: z.enum(["none", "one_parent", "both_parents"]),
    symptoms: z.array(
      z.enum([
        "frequent_urination",
        "excessive_thirst",
        "unexplained_weight_loss",
        "blurred_vision",
        "fatigue",
        "slow_wound_healing",
        "none",
      ]),
    ),
    notes: z.string().optional(),
    hba1c: z.number().nullable(),
    fastingGlucose: z.number().nullable(),
    randomGlucose: z.number().nullable(),
  }),
  screeningResult: z.any(),
});

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = explainRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid explanation request." }, { status: 400 });
  }

  const { language } = parsed.data;

  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        {
          error: translate(language, "validation.aiUnavailableWithoutApiKey"),
        },
        { status: 503 },
      );
    }

    const explanation = await generateRiskExplanation(parsed.data);
    return NextResponse.json(explanation, {
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
