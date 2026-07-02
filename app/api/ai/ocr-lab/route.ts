import { NextResponse } from "next/server";
import { extractLabValuesFromImage } from "@/lib/ai/LabOCRAgent";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "AI OCR is not configured on the server." },
        { status: 503 },
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No image file received." }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64DataUrl = `data:${file.type};base64,${buffer.toString("base64")}`;

    const result = await extractLabValuesFromImage({
      mimeType: file.type,
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
            : "AI OCR failed. Please enter values manually.",
      },
      { status: 500 },
    );
  }
}
