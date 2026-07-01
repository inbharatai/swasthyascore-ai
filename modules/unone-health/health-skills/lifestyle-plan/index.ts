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
import { sanitizeUnsafeWording, SAFETY_NOTE } from "@/modules/unone-health/core/safety";
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
  // Unconditionally sanitize EVERY user-facing text field. sanitizeUnsafeWording
  // is a no-op on clean text, so this is cheap and robust — a diagnosis or
  // prescription that slips into a finding title or a lifestyle item is caught
  // here, not just in the three top-level summaries.
  return {
    ...advisory,
    diagnosis_claimed: false,
    medicine_prescribed: false,
    safety_note: advisory.safety_note || SAFETY_NOTE,
    user_message: sanitizeUnsafeWording(advisory.user_message),
    doctor_summary: sanitizeUnsafeWording(advisory.doctor_summary),
    family_summary: sanitizeUnsafeWording(advisory.family_summary),
    top_findings: advisory.top_findings.map((f) => ({
      ...f,
      title: sanitizeUnsafeWording(f.title),
      why_it_matters: sanitizeUnsafeWording(f.why_it_matters),
      recommended_next_step: sanitizeUnsafeWording(f.recommended_next_step),
    })),
    lifestyle_plan: {
      ...advisory.lifestyle_plan,
      diet: advisory.lifestyle_plan.diet.map(sanitizeUnsafeWording),
      activity: advisory.lifestyle_plan.activity.map(sanitizeUnsafeWording),
      sleep: advisory.lifestyle_plan.sleep.map(sanitizeUnsafeWording),
      hydration: advisory.lifestyle_plan.hydration.map(sanitizeUnsafeWording),
      avoid: advisory.lifestyle_plan.avoid.map(sanitizeUnsafeWording),
      follow_up: advisory.lifestyle_plan.follow_up.map(sanitizeUnsafeWording),
    },
  };
}

// keep the internal alias used above
function enforceSafety(advisory: HealthAdvisory): HealthAdvisory {
  return enforceHealthAdvisorySafety(advisory);
}