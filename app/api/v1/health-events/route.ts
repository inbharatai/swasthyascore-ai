import { NextResponse } from "next/server";
import { healthEventSchema } from "@/modules/unone-health/core/types";
import { serverEventStore } from "@/modules/unone-health/adapters/swasthyak-adapter/serverStore";
import { isoNow } from "@/modules/unone-health/core/id";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = healthEventSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid health event.", details: parsed.error.message },
        { status: 400 },
      );
    }

    const event = parsed.data;
    if (event.safety.diagnosis_claimed || event.safety.medicine_prescribed) {
      return NextResponse.json(
        { error: "Event violates safety contract (diagnosis/prescription)." },
        { status: 422 },
      );
    }
    if (event.privacy.raw_video_uploaded) {
      return NextResponse.json(
        { error: "Raw face video upload is not permitted by default." },
        { status: 422 },
      );
    }

    const stored = { ...event, synced_at: isoNow() };
    serverEventStore.save(stored);

    return NextResponse.json(
      { event_id: stored.event_id },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save event." },
      { status: 500 },
    );
  }
}