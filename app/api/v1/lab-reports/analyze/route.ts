import { NextResponse } from "next/server";
import type { HealthEvent, LabReportEvent } from "@/modules/unone-health/core/types";
import { labReportEventSchema } from "@/modules/unone-health/core/types";
import {
  analyzeLabReport,
  isAcceptedLabFile,
} from "@/modules/unone-health/health-skills/lab-lens/LabLensAgent";
import {
  serverEventStore,
  serverLabFileStore,
} from "@/modules/unone-health/adapters/swasthyak-adapter/serverStore";
import { uuid, isoNow } from "@/modules/unone-health/core/id";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OpenAI is not configured on the server." },
        { status: 503 },
      );
    }

    const body = (await request.json()) as {
      report_id?: string;
      patient_id?: string;
      mime_type?: string;
      base64_data_url?: string;
      filename?: string;
      consent_given?: boolean;
    };

    if (!body.patient_id) {
      return NextResponse.json({ error: "patient_id is required." }, { status: 400 });
    }
    if (!body.consent_given) {
      return NextResponse.json(
        { error: "Lab analysis requires explicit consent." },
        { status: 422 },
      );
    }

    let mimeType = body.mime_type;
    let base64DataUrl = body.base64_data_url;
    let filename = body.filename ?? "lab-report";

    if (body.report_id) {
      const stored = serverLabFileStore.get(body.report_id);
      if (!stored || stored.patient_id !== body.patient_id) {
        return NextResponse.json({ error: "Report not found." }, { status: 404 });
      }
      mimeType = stored.mime_type;
      base64DataUrl = stored.base64_data_url;
      filename = stored.filename;
    }

    if (!mimeType || !base64DataUrl) {
      return NextResponse.json(
        { error: "Provide either report_id or (mime_type + base64_data_url)." },
        { status: 400 },
      );
    }
    if (!isAcceptedLabFile(mimeType)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${mimeType}` },
        { status: 415 },
      );
    }

    const lens = await analyzeLabReport({
      mimeType,
      base64DataUrl,
      filename,
    });

    const event: LabReportEvent = {
      event_id: uuid(),
      patient_id: body.patient_id,
      source: "openai_5_5",
      event_type: "lab_report",
      report_metadata: lens.report_metadata,
      markers: lens.markers,
      critical_flags: lens.critical_flags,
      overall_summary: lens.overall_summary,
      confidence: lens.confidence,
      raw_file_uploaded: true,
      created_at: isoNow(),
    };

    const parsed = labReportEventSchema.safeParse(event);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Lab lens produced invalid output.", details: parsed.error.message },
        { status: 500 },
      );
    }

    const healthEvent: HealthEvent = {
      event_id: event.event_id,
      patient_id: event.patient_id,
      source: "openai_5_5",
      event_type: "lab_report",
      confidence: event.confidence,
      payload: event as unknown as Record<string, unknown>,
      privacy: {
        consent_given: true,
        raw_video_uploaded: false,
        raw_report_uploaded: true,
      },
      safety: { diagnosis_claimed: false, medicine_prescribed: false },
      created_at: event.created_at,
      synced_at: event.created_at,
    };
    serverEventStore.save(healthEvent);

    return NextResponse.json(event, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Lab analysis failed. Please enter values manually.",
      },
      { status: 500 },
    );
  }
}