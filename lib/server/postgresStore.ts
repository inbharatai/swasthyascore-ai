import { sql } from "@vercel/postgres";
import type { HealthEvent } from "@/modules/unone-health/core/types";
import type { StoredLabFile } from "@/modules/unone-health/adapters/swasthyak-adapter/serverStore";

/**
 * Vercel Postgres-backed durable store for health events + uploaded lab files.
 *
 * This module is imported LAZILY by `serverStore.ts` only when a Postgres
 * connection URL is present in the environment — so the Node test suite and
 * `next build` never load `@vercel/postgres` or attempt a DB connection.
 *
 * Schema is created idempotently on first use (`CREATE TABLE IF NOT EXISTS`),
 * so no separate migration step is required: the first request after the
 * database is connected bootstraps the tables. `health_events` stores the full
 * canonical event as JSONB (the route + adapter signatures are unchanged) with
 * `patient_id` + `created_at` extracted for the timeline lookup.
 *
 * EXPERIMENTAL context: rPPG vital-scan EVENTS persisted here still carry the
 * "experimental / not clinically validated" wording inside their payload — the
 * store is transport-only and never strips safety metadata.
 */

let schemaPromise: Promise<void> | null = null;

function ensureSchema(): Promise<void> {
  if (!schemaPromise) {
    // Memoise; on failure clear so the next call retries instead of caching a
    // rejected promise that would break every subsequent request.
    schemaPromise = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS health_events (
          event_id   TEXT PRIMARY KEY,
          patient_id TEXT NOT NULL,
          event_type TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL,
          synced_at  TIMESTAMPTZ,
          data       JSONB NOT NULL
        )
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS idx_health_events_patient
        ON health_events (patient_id, created_at)
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS lab_files (
          report_id       TEXT PRIMARY KEY,
          patient_id      TEXT NOT NULL,
          mime_type       TEXT NOT NULL,
          base64_data_url TEXT NOT NULL,
          filename        TEXT NOT NULL,
          created_at      TIMESTAMPTZ NOT NULL
        )
      `;
    })().catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }
  return schemaPromise;
}

/** Coerce a DB-returned timestamp (Date | string) back to an ISO string. */
function toIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

/** Coerce a DB-returned JSONB value (object | string) to the typed shape. */
function fromJsonb<T>(value: unknown): T {
  return (typeof value === "string" ? (JSON.parse(value) as T) : (value as T));
}

export const pgEventStore = {
  async save(event: HealthEvent): Promise<void> {
    await ensureSchema();
    const json = JSON.stringify(event);
    await sql`
      INSERT INTO health_events (event_id, patient_id, event_type, created_at, synced_at, data)
      VALUES (${event.event_id}, ${event.patient_id}, ${event.event_type}, ${event.created_at}, ${event.synced_at ?? null}, ${json}::jsonb)
      ON CONFLICT (event_id) DO UPDATE
        SET data = EXCLUDED.data,
            synced_at = EXCLUDED.synced_at,
            created_at = EXCLUDED.created_at
    `;
  },

  async list(patientId: string): Promise<HealthEvent[]> {
    await ensureSchema();
    const { rows } = await sql`
      SELECT data FROM health_events
      WHERE patient_id = ${patientId}
      ORDER BY created_at ASC
    `;
    return rows.map((row) => fromJsonb<HealthEvent>(row.data));
  },

  async get(eventId: string): Promise<HealthEvent | undefined> {
    await ensureSchema();
    const { rows } = await sql`
      SELECT data FROM health_events WHERE event_id = ${eventId}
    `;
    if (rows.length === 0) return undefined;
    return fromJsonb<HealthEvent>(rows[0].data);
  },
};

export const pgLabFileStore = {
  async save(file: StoredLabFile): Promise<void> {
    await ensureSchema();
    await sql`
      INSERT INTO lab_files (report_id, patient_id, mime_type, base64_data_url, filename, created_at)
      VALUES (${file.report_id}, ${file.patient_id}, ${file.mime_type}, ${file.base64_data_url}, ${file.filename}, ${file.created_at})
      ON CONFLICT (report_id) DO UPDATE
        SET base64_data_url = EXCLUDED.base64_data_url,
            mime_type = EXCLUDED.mime_type,
            filename = EXCLUDED.filename
    `;
  },

  async get(reportId: string): Promise<StoredLabFile | undefined> {
    await ensureSchema();
    const { rows } = await sql`
      SELECT report_id, patient_id, mime_type, base64_data_url, filename, created_at
      FROM lab_files WHERE report_id = ${reportId}
    `;
    if (rows.length === 0) return undefined;
    const row = rows[0] as Record<string, unknown>;
    return {
      report_id: String(row.report_id),
      patient_id: String(row.patient_id),
      mime_type: String(row.mime_type),
      base64_data_url: String(row.base64_data_url),
      filename: String(row.filename),
      created_at: toIso(row.created_at),
    };
  },
};