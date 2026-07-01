import { z } from "zod";
import type {
  HealthAdvisory,
  HealthEvent,
  LabReportEvent,
  SymptomEvent,
  ToolDescriptor,
  VitalScanResult,
} from "@/modules/unone-health/core/types";
import { healthAdvisorySchema } from "@/modules/unone-health/core/types";
import { uuid } from "@/modules/unone-health/core/id";
import { sanitizeUnsafeWording, SAFETY_NOTE, scanForUnsafeWording } from "@/modules/unone-health/core/safety";
import { generateHealthAdvisory } from "./HealthAdvisoryAgent";

const profileSchema = z.object({
  age: z.number().optional(),
  sex: z.string().optional(),
  known_conditions: z.array(z.string()).default([]),
  medications: z.array(z.string()).default([]),
  bmi: z.number().optional(),
});

const previousEventSchema = z.object({
  event_type: z.string(),
  summary: z.string(),
});

export const advisoryInputSchema = z.object({
  patient_id: z.string().min(1),
  profile: profileSchema,
  lab_report: z.any().optional(),
  vitals: z.any().optional(),
  symptoms: z.any().optional(),
  previous_events: z.array(previousEventSchema).default([]),
  consent_given: z.boolean(),
});

export function createGeneratePlanTool(): ToolDescriptor {
  return {
    name: "health.reasoning.generate_plan",
    namespace: "health.reasoning",
    description:
      "Combine lab markers, rPPG vitals, symptoms, voice notes and profile into safe, supportive health guidance via OpenAI 5.5. No diagnosis, no prescription. Post-checks safety wording before returning.",
    permissions: ["network"],
    offline_supported: false,
    input_schema: advisoryInputSchema,
    output_schema: healthAdvisorySchema,
    safety_flags: [
      "no_diagnosis",
      "no_prescription",
      "confidence_required",
      "emergency_red_flags",
    ],
    async run(input, context) {
      const data = input as z.infer<typeof advisoryInputSchema>;
      if (!data.consent_given) {
        throw new Error("Health advisory requires explicit consent.");
      }

      const advisory = await generateHealthAdvisory({
        profile: {
          age: data.profile.age,
          sex: data.profile.sex,
          knownConditions: data.profile.known_conditions,
          medications: data.profile.medications,
          bmi: data.profile.bmi,
        },
        labReport: (data.lab_report ?? null) as LabReportEvent | null,
        vitals: (data.vitals ?? null) as VitalScanResult | null,
        symptoms: (data.symptoms ?? null) as SymptomEvent | null,
        previousEvents: data.previous_events,
      });

      const safe = enforceSafety(advisory);

      const healthEvent: HealthEvent = {
        event_id: uuid(),
        patient_id: context.patientId,
        source: "openai_5_5",
        event_type: "health_advisory",
        confidence: 0.8,
        payload: safe as unknown as Record<string, unknown>,
        privacy: {
          consent_given: true,
          raw_video_uploaded: false,
          raw_report_uploaded: false,
        },
        safety: {
          diagnosis_claimed: false,
          medicine_prescribed: false,
        },
        created_at: context.now(),
        synced_at: context.online ? context.now() : null,
      };
      context.events.save(healthEvent);
      return safe;
    },
  };
}

/**
 * Post-check the advisory text for diagnosis/prescription wording. If found,
 * sanitize and append the standard safety note. Always force the safety flags
 * false and the canonical safety_note. Shared by the tool and the API route.
 */
export function enforceHealthAdvisorySafety(
  advisory: HealthAdvisory,
): HealthAdvisory {
  const scan = scanForUnsafeWording(
    advisory.user_message,
    advisory.doctor_summary,
    advisory.family_summary,
    ...advisory.top_findings.map((f) => `${f.title} ${f.why_it_matters} ${f.recommended_next_step}`),
    ...advisory.lifestyle_plan.diet,
    ...advisory.lifestyle_plan.activity,
    ...advisory.lifestyle_plan.follow_up,
  );

  let sanitized: HealthAdvisory = {
    ...advisory,
    diagnosis_claimed: false,
    medicine_prescribed: false,
    safety_note: advisory.safety_note || SAFETY_NOTE,
  };

  if (!scan.clean) {
    sanitized = {
      ...sanitized,
      user_message: sanitizeUnsafeWording(advisory.user_message),
      doctor_summary: sanitizeUnsafeWording(advisory.doctor_summary),
      family_summary: sanitizeUnsafeWording(advisory.family_summary),
    };
  }

  return sanitized;
}

// keep the internal alias used above
function enforceSafety(advisory: HealthAdvisory): HealthAdvisory {
  return enforceHealthAdvisorySafety(advisory);
}