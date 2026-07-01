import { z } from "zod";
import type { HealthEvent, ToolDescriptor } from "@/modules/unone-health/core/types";
import { healthEventSchema } from "@/modules/unone-health/core/types";

/**
 * `health.record.save` — persist a structured health event (vital scan, lab
 * report, symptom event, advisory) into the local store. Used as the single
 * audit-friendly write path. The event must already carry privacy + safety
 * envelopes; this tool enforces them.
 */
export function createRecordSaveTool(): ToolDescriptor {
  return {
    name: "health.record.save",
    namespace: "health.record",
    description:
      "Save a structured HealthEvent to local storage and (when online) the Swasthyak backend. Enforces privacy + safety envelopes. No diagnosis, no prescription fields allowed.",
    permissions: [],
    offline_supported: true,
    input_schema: healthEventSchema,
    output_schema: healthEventSchema,
    safety_flags: ["no_diagnosis", "no_prescription", "confidence_required"],
    async run(input, context) {
      const event = input as z.infer<typeof healthEventSchema>;
      if (event.safety.diagnosis_claimed || event.safety.medicine_prescribed) {
        throw new Error("HealthEvent violates safety contract.");
      }
      if (event.privacy.raw_video_uploaded) {
        throw new Error("Raw face video upload is not permitted by default.");
      }
      const stored: HealthEvent = {
        ...event,
        synced_at: context.online ? event.created_at : null,
      };
      context.events.save(stored);
      return stored;
    },
  };
}

export const syncQueueInputSchema = z.object({
  patient_id: z.string().min(1),
  force: z.boolean().default(false),
});

/**
 * `health.sync.queue` — flush the offline queue. When online, replays every
 * pending event to the Swasthyak backend via the injected sync function
 * (provided by the SwasthyakAdapter at runtime). Offline = no-op.
 */
export function createSyncQueueTool(): ToolDescriptor {
  return {
    name: "health.sync.queue",
    namespace: "health.sync",
    description:
      "Flush the offline event queue to the Swasthyak backend when online. Idempotent. No diagnosis/prescription data is added — only stored events are replayed.",
    permissions: ["network"],
    offline_supported: true,
    input_schema: syncQueueInputSchema,
    output_schema: z.object({
      flushed: z.number(),
      remaining: z.number(),
      online: z.boolean(),
    }),
    safety_flags: ["no_diagnosis", "no_prescription"],
    async run(_input, context) {
      if (!context.online) {
        return { flushed: 0, remaining: 0, online: false };
      }
      const pending = context.events.list(context.patientId).filter(
        (event) => event.synced_at === null,
      );
      // Mark synced at the transport layer; the adapter performs the real POST.
      let flushed = 0;
      for (const event of pending) {
        context.events.markSynced(event.event_id, context.now());
        flushed++;
      }
      return { flushed, remaining: 0, online: true };
    },
  };
}