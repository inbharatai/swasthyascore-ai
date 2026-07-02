import { z } from "zod";
import type {
  HealthEvent,
  ToolDescriptor,
  VitalScanResult,
} from "@/modules/unone-health/core/types";
import { vitalScanResultSchema } from "@/modules/unone-health/core/types";
import { uuid } from "@/modules/unone-health/core/id";
import type { RppgEngine, RppgScanParams } from "./engine";
import { finalizeVitalScan } from "./engine";

export const rppgScanInputSchema = z.object({
  camera_mode: z.enum(["front_face", "rear_face", "rear_finger", "unknown"]),
  duration_seconds: z.number().int().min(10).max(60).default(20),
});

/**
 * Factory: build the `health.vitals.rppg_scan` tool bound to a concrete engine.
 * The engine (signal + a real camera FrameProvider) is supplied at runtime by
 * the UI, so the tool itself contains no browser/DOM code and is safe to
 * register anywhere.
 */
export function createRppgScanTool(engine: RppgEngine): ToolDescriptor {
  return {
    name: "health.vitals.rppg_scan",
    namespace: "health.vitals",
    description:
      "Camera-based rPPG vital scan. Runs entirely on-device. OpenAI is never used to compute vitals. Returns HR (and RR for front-face mode) with a local confidence score; raw face video is never uploaded.",
    permissions: ["camera"],
    offline_supported: true,
    input_schema: rppgScanInputSchema,
    output_schema: vitalScanResultSchema,
    safety_flags: [
      "no_diagnosis",
      "no_raw_face_video",
      "requires_consent",
      "confidence_required",
    ],
    async run(input, context) {
      const data = input as z.infer<typeof rppgScanInputSchema>;
      const params: RppgScanParams = {
        cameraMode: data.camera_mode,
        durationSeconds: data.duration_seconds,
      };
      const samples = await engine.scan(params);
      const result = finalizeVitalScan(
        samples,
        params,
        engine.id,
        context.now(),
      );

      const event: HealthEvent = {
        event_id: uuid(),
        patient_id: context.patientId,
        source: "unone_health",
        event_type: "vital_scan",
        confidence: result.confidence,
        payload: result as unknown as Record<string, unknown>,
        privacy: {
          consent_given: context.consent.camera,
          raw_video_uploaded: false,
          raw_report_uploaded: false,
        },
        safety: { diagnosis_claimed: false, medicine_prescribed: false },
        created_at: result.created_at,
        synced_at: context.online ? result.created_at : null,
      };
      context.events.save(event);

      return result as VitalScanResult;
    },
  };
}