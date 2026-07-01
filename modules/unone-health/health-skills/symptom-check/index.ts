import { z } from "zod";
import type {
  HealthEvent,
  SymptomEvent,
  ToolDescriptor,
} from "@/modules/unone-health/core/types";
import { symptomEventSchema } from "@/modules/unone-health/core/types";
import { detectRedFlags } from "@/modules/unone-health/core/safety";
import { uuid } from "@/modules/unone-health/core/id";

export const symptomCollectInputSchema = z.object({
  patient_id: z.string().min(1),
  text: z.string().min(1),
  source: z.enum(["text", "voice"]).default("text"),
  duration: z.string().nullable().default(null),
});

const SEVERE_HINTS = [
  "severe",
  "unbearable",
  "cannot breathe",
  "crushing",
  "passing out",
  "vomiting blood",
  "blood in stool",
  "worst ever",
];
const MODERATE_HINTS = [
  "persistent",
  "recurring",
  "several days",
  "worsening",
  "fever",
  "dehydrated",
];

export function classifySeverity(
  text: string,
  redFlags: string[],
): "mild" | "moderate" | "severe" | "unknown" {
  const lower = text.toLowerCase();
  if (redFlags.length > 0) return "severe";
  if (SEVERE_HINTS.some((hint) => lower.includes(hint))) return "severe";
  if (MODERATE_HINTS.some((hint) => lower.includes(hint))) return "moderate";
  if (text.trim().length > 0) return "mild";
  return "unknown";
}

export function splitSymptoms(text: string): string[] {
  return text
    .split(/[\n,.;]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1);
}

export function createSymptomCollectTool(): ToolDescriptor {
  return {
    name: "health.symptoms.collect",
    namespace: "health.symptoms",
    description:
      "Collect symptoms from typed or transcribed text. Runs locally (offline-capable): detects emergency red flags, classifies severity, and builds a structured SymptomEvent. No diagnosis, no prescription.",
    permissions: [],
    offline_supported: true,
    input_schema: symptomCollectInputSchema,
    output_schema: symptomEventSchema,
    safety_flags: [
      "no_diagnosis",
      "no_prescription",
      "emergency_red_flags",
    ],
    async run(input, context) {
      const data = input as z.infer<typeof symptomCollectInputSchema>;
      const redFlags = detectRedFlags(data.text);
      const symptoms = splitSymptoms(data.text);
      const severity = classifySeverity(data.text, redFlags);
      const summary = buildSummary(symptoms, severity, redFlags);
      const event: SymptomEvent = {
        event_type: "symptom_event",
        source: data.source,
        symptoms,
        duration: data.duration,
        severity,
        red_flags: redFlags,
        summary,
        created_at: context.now(),
      };

      const healthEvent: HealthEvent = {
        event_id: uuid(),
        patient_id: context.patientId,
        source: "unone_health",
        event_type: "symptom_event",
        confidence: severity === "unknown" ? 0.4 : 0.7,
        payload: event as unknown as Record<string, unknown>,
        privacy: {
          consent_given: true,
          raw_video_uploaded: false,
          raw_report_uploaded: false,
        },
        safety: { diagnosis_claimed: false, medicine_prescribed: false },
        created_at: event.created_at,
        synced_at: context.online ? event.created_at : null,
      };
      context.events.save(healthEvent);
      return event;
    },
  };
}

function buildSummary(
  symptoms: string[],
  severity: SymptomEvent["severity"],
  redFlags: string[],
): string {
  const head = symptoms.slice(0, 3).join("; ");
  let message = `Reported symptoms (${severity}): ${head || "none described"}.`;
  if (redFlags.length > 0) {
    message +=
      " Possible emergency signs detected. This is not a diagnosis — seek urgent medical care if symptoms are severe.";
  } else {
    message +=
      " This is not a diagnosis. Discuss persistent or worsening symptoms with a doctor.";
  }
  return message;
}