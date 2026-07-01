import { z } from "zod";
import type {
  HealthEvent,
  SymptomEvent,
  ToolDescriptor,
} from "@/modules/unone-health/core/types";
import { symptomEventSchema } from "@/modules/unone-health/core/types";
import { detectRedFlags } from "@/modules/unone-health/core/safety";
import { uuid } from "@/modules/unone-health/core/id";
import { summarizeVoiceNote } from "./VoiceGuideAgent";

export const voiceSummarizeInputSchema = z.object({
  patient_id: z.string().min(1),
  transcript: z.string().min(1),
  consent_given: z.boolean(),
  patient_age: z.number().optional(),
  patient_sex: z.string().optional(),
});

export function createVoiceSummarizeTool(): ToolDescriptor {
  return {
    name: "health.voice.summarize",
    namespace: "health.voice",
    description:
      "Convert a voice-note transcript into a structured symptom/history summary using OpenAI 5.5. No diagnosis, no prescription. Requires voice consent.",
    permissions: ["voice_consent", "network"],
    offline_supported: false,
    input_schema: voiceSummarizeInputSchema,
    output_schema: symptomEventSchema,
    safety_flags: ["no_diagnosis", "no_prescription", "requires_consent"],
    async run(input, context) {
      const data = input as z.infer<typeof voiceSummarizeInputSchema>;
      if (!data.consent_given) {
        throw new Error("Voice analysis requires explicit consent.");
      }
      const ai = await summarizeVoiceNote({
        transcript: data.transcript,
        patientAge: data.patient_age,
        patientSex: data.patient_sex,
      });

      // Cross-check the model's red flags with the local matcher so nothing
      // dangerous slips through either direction.
      const localFlags = detectRedFlags(data.transcript, ai.summary);
      const redFlags = Array.from(new Set([...ai.red_flags, ...localFlags]));

      const event: SymptomEvent = {
        event_type: "symptom_event",
        source: "voice",
        symptoms: ai.symptoms,
        duration: ai.duration,
        severity: ai.severity,
        red_flags: redFlags,
        summary: ai.summary,
        created_at: context.now(),
      };

      const healthEvent: HealthEvent = {
        event_id: uuid(),
        patient_id: context.patientId,
        source: "openai_5_5",
        event_type: "voice_note",
        confidence: 0.8,
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