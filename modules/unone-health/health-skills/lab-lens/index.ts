import { z } from "zod";
import type {
  HealthEvent,
  LabReportEvent,
  ToolDescriptor,
} from "@/modules/unone-health/core/types";
import { labReportEventSchema } from "@/modules/unone-health/core/types";
import { uuid } from "@/modules/unone-health/core/id";
import { analyzeLabReport, isAcceptedLabFile } from "./LabLensAgent";

export const labExtractInputSchema = z.object({
  patient_id: z.string().min(1),
  mime_type: z.string(),
  base64_data_url: z.string().min(1),
  filename: z.string().optional(),
  consent_given: z.boolean(),
  raw_file_uploaded: z.boolean().default(true),
});

export function createLabExtractMarkersTool(): ToolDescriptor {
  return {
    name: "health.lab.extract_markers",
    namespace: "health.lab",
    description:
      "Extract lab report markers from a PDF/image/photo using OpenAI 5.5. Uses the report's own reference ranges. Never diagnoses or prescribes. Requires explicit consent and a raw file upload.",
    permissions: ["file_upload", "lab_consent", "network"],
    offline_supported: false,
    input_schema: labExtractInputSchema,
    output_schema: labReportEventSchema,
    safety_flags: [
      "no_diagnosis",
      "no_prescription",
      "requires_consent",
      "confidence_required",
    ],
    async run(input, context) {
      const data = input as z.infer<typeof labExtractInputSchema>;
      if (!data.consent_given) {
        throw new Error("Lab report analysis requires explicit consent.");
      }
      if (!isAcceptedLabFile(data.mime_type)) {
        throw new Error(`Unsupported file type: ${data.mime_type}`);
      }

      const lens = await analyzeLabReport({
        mimeType: data.mime_type,
        base64DataUrl: data.base64_data_url,
        filename: data.filename,
      });

      const event: LabReportEvent = {
        event_id: uuid(),
        patient_id: data.patient_id,
        source: "openai_5_5",
        event_type: "lab_report",
        report_metadata: lens.report_metadata,
        markers: lens.markers,
        critical_flags: lens.critical_flags,
        overall_summary: lens.overall_summary,
        confidence: lens.confidence,
        raw_file_uploaded: data.raw_file_uploaded,
        created_at: context.now(),
      };

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
          raw_report_uploaded: event.raw_file_uploaded,
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

export type { LabReportEvent };