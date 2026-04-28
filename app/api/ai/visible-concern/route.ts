import { NextResponse } from "next/server";
import { z } from "zod";
import { explainVisibleConcernFromImage } from "@/lib/ai/VisibleConcernAgent";
import { translate } from "@/lib/i18n";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const languageSchema = z.enum(["en", "hi"]).catch("en");

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const language = languageSchema.parse(formData.get("language"));

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: translate(language, "validation.aiUnavailableWithoutApiKey") },
        { status: 503 },
      );
    }

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: translate(language, "camera.noImage") },
        { status: 400 },
      );
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: translate(language, "camera.imageOnly") },
        { status: 400 },
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64DataUrl = `data:${file.type};base64,${buffer.toString("base64")}`;
    const result = await explainVisibleConcernFromImage({
      language,
      base64DataUrl,
    });

    return NextResponse.json(result, {
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
            : "Visible concern analysis failed.",
      },
      { status: 500 },
    );
  }
}
