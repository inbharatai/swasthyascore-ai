import { NextResponse } from "next/server";
import {
  vitalScanResultSchema,
  type HealthEvent,
  type VitalScanResult,
} from "@/modules/unone-health/core/types";
import { serverEventStore } from "@/modules/unone-health/adapters/swasthyak-adapter/serverStore";
import { uuid, isoNow } from "@/modules/unone-health/core/id";
import { serverError } from "@/modules/unone-health/core/routeErrors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The rPPG vital scan is computed entirely client-side (no raw video is ever
 * uploaded). This endpoint only persists the already-computed VitalScanResult
 * as an audit-friendly HealthEvent.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      patient_id?: string;
      result?: VitalScanResult;
    };

    if (!body.patient_id || !body.result) {
      return NextResponse.json(
        { error: "patient_id and result are required." },
        { status: 400 },
      );
    }

    const parsed = vitalScanResultSchema.safeParse(body.result);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid vital scan result.", details: parsed.error.message },
        { status: 400 },
      );
    }
    if (parsed.data.raw_video_uploaded) {
      return NextResponse.json(
        { error: "Raw face video upload is not permitted." },
        { status: 422 },
      );
    }

    const now = isoNow();
    const event: HealthEvent = {
      event_id: uuid(),
      patient_id: body.patient_id,
      source: "unone_health",
      event_type: "vital_scan",
      confidence: parsed.data.confidence,
      payload: parsed.data as unknown as Record<string, unknown>,
      privacy: {
        consent_given: true,
        raw_video_uploaded: false,
        raw_report_uploaded: false,
      },
      safety: { diagnosis_claimed: false, medicine_prescribed: false },
      created_at: now,
      synced_at: now,
    };
    serverEventStore.save(event);

    return NextResponse.json(
      { event_id: event.event_id },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      { error: serverError("vital-scan", error, "Could not save the vital scan. Please try again.").message },
      { status: 500 },
    );
  }
}