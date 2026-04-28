import { NextResponse } from "next/server";
import { z } from "zod";
import { reviewExplanationSafety } from "@/lib/ai/SafetyReviewAgent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const safetyReviewRequestSchema = z.object({
  language: z.enum(["en", "hi"]),
  explanation: z.object({
    summary: z.string(),
    simpleExplanation: z.string(),
    topRiskFactors: z.array(z.string()),
    recommendedNextSteps: z.array(z.string()),
    doctorReferralNote: z.string(),
    lifestyleAdvice: z.array(z.string()),
    safetyDisclaimer: z.string(),
  }),
});

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = safetyReviewRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid safety review request." },
      { status: 400 },
    );
  }

  const reviewed = reviewExplanationSafety(
    parsed.data.language,
    parsed.data.explanation,
  );

  return NextResponse.json(reviewed, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
