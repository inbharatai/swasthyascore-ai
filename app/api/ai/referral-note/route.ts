import { NextResponse } from "next/server";
import { z } from "zod";
import { generateReferralNote } from "@/lib/ai/ReferralNoteAgent";
import { translate } from "@/lib/i18n";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const referralRequestSchema = z.object({
  language: z.enum(["en", "hi"]),
  patientValues: z.any(),
  screeningResult: z.any(),
});

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = referralRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid referral note request." },
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

    const referral = await generateReferralNote(parsed.data);
    return NextResponse.json(
      { referralNote: referral.note },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
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
