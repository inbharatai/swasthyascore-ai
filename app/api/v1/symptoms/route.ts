import { NextResponse } from "next/server";
import {
  symptomEventSchema,
  type HealthEvent,
  type SymptomEvent,
} from "@/modules/unone-health/core/types";
import { detectRedFlags } from "@/modules/unone-health/core/safety";
import {
  classifySeverity,
  splitSymptoms,
} from "@/modules/unone-health/health-skills/symptom-check";
import { serverEventStore } from "@/modules/unone-health/adapters/swasthyak-adapter/serverStore";
import { uuid, isoNow } from "@/modules/unone-health/core/id";
import { serverError } from "@/modules/unone-health/core/routeErrors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      patient_id?: string;
      text?: string;
      source?: "text" | "voice";
      duration?: string | null;
      /** Caller may pass a pre-built SymptomEvent instead of raw text. */
      event?: SymptomEvent;
    };

    if (!body.patient_id) {
      return NextResponse.json({ error: "patient_id is required." }, { status: 400 });
    }

    let event: SymptomEvent;
    if (body.event) {
      const parsed = symptomEventSchema.safeParse(body.event);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "Invalid symptom event.", details: parsed.error.message },
          { status: 400 },
        );
      }
      event = parsed.data;
    } else {
      if (!body.text) {
        return NextResponse.json(
          { error: "text or event is required." },
          { status: 400 },
        );
      }
      const redFlags = detectRedFlags(body.text);
      const symptoms = splitSymptoms(body.text);
      const severity = classifySeverity(body.text, redFlags);
      event = {
        event_type: "symptom_event",
        source: body.source ?? "text",
        symptoms,
        duration: body.duration ?? null,
        severity,
        red_flags: redFlags,
        summary: `${symptoms.slice(0, 3).join("; ") || "no symptoms described"}. This is not a diagnosis — discuss with a doctor.`,
        created_at: isoNow(),
      };
    }

    const now = isoNow();
    const stored: HealthEvent = {
      event_id: uuid(),
      patient_id: body.patient_id,
      source: "unone_health",
      event_type: "symptom_event",
      confidence: event.severity === "unknown" ? 0.4 : 0.7,
      payload: event as unknown as Record<string, unknown>,
      privacy: {
        consent_given: true,
        raw_video_uploaded: false,
        raw_report_uploaded: false,
      },
      safety: { diagnosis_claimed: false, medicine_prescribed: false },
      created_at: event.created_at,
      synced_at: now,
    };
    serverEventStore.save(stored);

    return NextResponse.json(
      { event_id: stored.event_id, event },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      { error: serverError("symptoms", error, "Could not save symptoms. Please try again.").message },
      { status: 500 },
    );
  }
}