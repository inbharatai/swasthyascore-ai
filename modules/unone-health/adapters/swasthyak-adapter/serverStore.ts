import type { HealthEvent } from "@/modules/unone-health/core/types";

/**
 * PLACEHOLDER in-memory backend store for the Swasthyak Cloud AI routes.
 *
 * This exists so the `/api/v1` route handlers work end-to-end for demos and
 * connected-hospital pilots without a real backend. It is intentionally
 * process-local and resets on redeploy — the real Swasthyak backend replaces
 * it later without touching the route signatures or the adapter.
 */
export interface StoredLabFile {
  report_id: string;
  patient_id: string;
  mime_type: string;
  base64_data_url: string;
  filename: string;
  created_at: string;
}

const events = new Map<string, HealthEvent>();
const labFiles = new Map<string, StoredLabFile>();

export const serverEventStore = {
  save(event: HealthEvent): void {
    events.set(event.event_id, event);
  },
  list(patientId: string): HealthEvent[] {
    return [...events.values()]
      .filter((event) => event.patient_id === patientId)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
  },
  get(eventId: string): HealthEvent | undefined {
    return events.get(eventId);
  },
};

export const serverLabFileStore = {
  save(file: StoredLabFile): void {
    labFiles.set(file.report_id, file);
  },
  get(reportId: string): StoredLabFile | undefined {
    return labFiles.get(reportId);
  },
};