import { NextResponse } from "next/server";
import type { HealthEvent } from "@/modules/unone-health/core/types";
import { generateHealthAdvisory } from "@/modules/unone-health/health-skills/lifestyle-plan/HealthAdvisoryAgent";
import {
  enforceHealthAdvisorySafety,
  deriveAdvisoryConfidence,
} from "@/modules/unone-health/health-skills/lifestyle-plan";
import { serverEventStore } from "@/modules/unone-health/adapters/swasthyak-adapter/serverStore";
import { uuid, isoNow } from "@/modules/unone-health/core/id";
import { serverError } from "@/modules/unone-health/core/routeErrors";

export const runtime = "nodejs";
export const maxDuration = 60;
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
      patient_id?: string;
      profile?: {
        age?: number;
        sex?: string;
        known_conditions?: string[];
        medications?: string[];
        bmi?: number;
      };
      lab_report?: unknown;
      vitals?: unknown;
      symptoms?: unknown;
      previous_events?: { event_type: string; summary: string }[];
      consent_given?: boolean;
    };

    if (!body.patient_id) {
      return NextResponse.json({ error: "patient_id is required." }, { status: 400 });
    }
    if (!body.consent_given) {
      return NextResponse.json(
        { error: "Health advisory requires explicit consent." },
        { status: 422 },
      );
    }

    const advisory = await generateHealthAdvisory({
      profile: {
        age: body.profile?.age,
        sex: body.profile?.sex,
        knownConditions: body.profile?.known_conditions ?? [],
        medications: body.profile?.medications ?? [],
        bmi: body.profile?.bmi,
      },
      labReport: (body.lab_report ?? null) as never,
      vitals: (body.vitals ?? null) as never,
      symptoms: (body.symptoms ?? null) as never,
      previousEvents: body.previous_events ?? [],
    });

    const safe = enforceHealthAdvisorySafety(advisory);
    const now = isoNow();
    const event: HealthEvent = {
      event_id: uuid(),
      patient_id: body.patient_id,
      source: "openai_5_5",
      event_type: "health_advisory",
      confidence: deriveAdvisoryConfidence({
        profile: {
          age: body.profile?.age,
          sex: body.profile?.sex,
          bmi: body.profile?.bmi,
        },
        labReport: body.lab_report,
        vitals: body.vitals,
        symptoms: body.symptoms as {
          severity?: string | null;
          red_flags?: string[] | null;
        } | null,
      }),
      payload: safe as unknown as Record<string, unknown>,
      privacy: {
        consent_given: true,
        raw_video_uploaded: false,
        raw_report_uploaded: false,
      },
      safety: { diagnosis_claimed: false, medicine_prescribed: false },
      created_at: now,
      synced_at: now,
    };
    await serverEventStore.save(event);

    return NextResponse.json(safe, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      { error: serverError("health-advisory", error, "Health advisory could not be generated. Please try again.").message },
      { status: 500 },
    );
  }
}