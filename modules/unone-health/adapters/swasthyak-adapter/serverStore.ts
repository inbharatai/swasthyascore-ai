import type { HealthEvent } from "@/modules/unone-health/core/types";

/**
 * Backend store for the Swasthyak Cloud AI `/api/v1` route handlers.
 *
 * Two transports behind ONE async interface:
 *
 *  - **Vercel Postgres (durable)** — used when a Postgres connection URL is
 *    present in the environment (`POSTGRES_URL` / `POSTGRES_PRISMA_URL` /
 *    `DATABASE_URL`). The Postgres implementation (`lib/server/postgresStore`)
 *    is imported LAZILY via a dynamic `import()` so that the Node test suite,
 *    `next build`, and any environment without a database never load
 *    `@vercel/postgres` or attempt a connection.
 *
 *  - **In-memory Map (volatile)** — the original placeholder, used when no
 *    database is configured. It is process-local and resets on redeploy, which
 *    is fine for demos; the durable store takes over automatically the moment
 *    a Postgres resource is connected on Vercel.
 *
 * Both transports expose the same async `save` / `list` / `get` signatures, so
 * the route handlers simply `await` every call. No route signature changes.
 */
export interface StoredLabFile {
  report_id: string;
  patient_id: string;
  mime_type: string;
  base64_data_url: string;
  filename: string;
  created_at: string;
}

/** True when a Vercel Postgres (or compatible) connection URL is configured. */
export function isPostgresConfigured(): boolean {
  return Boolean(
    process.env.POSTGRES_URL ||
      process.env.POSTGRES_PRISMA_URL ||
      process.env.DATABASE_URL,
  );
}

// --- In-memory fallback ----------------------------------------------------

const events = new Map<string, HealthEvent>();
const labFiles = new Map<string, StoredLabFile>();

const inMemoryEventStore = {
  async save(event: HealthEvent): Promise<void> {
    events.set(event.event_id, event);
  },
  async list(patientId: string): Promise<HealthEvent[]> {
    return [...events.values()]
      .filter((event) => event.patient_id === patientId)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
  },
  async get(eventId: string): Promise<HealthEvent | undefined> {
    return events.get(eventId);
  },
};

const inMemoryLabFileStore = {
  async save(file: StoredLabFile): Promise<void> {
    labFiles.set(file.report_id, file);
  },
  async get(reportId: string): Promise<StoredLabFile | undefined> {
    return labFiles.get(reportId);
  },
};

// --- Lazy Postgres loader --------------------------------------------------
// Cached so we only `import()` once per process; dynamic so the module (and
// `@vercel/postgres`) is never loaded in tests / build / no-DB environments.

type PostgresStores = typeof import("@/lib/server/postgresStore");

let postgresStoresPromise: Promise<PostgresStores> | null = null;

function loadPostgresStores(): Promise<PostgresStores> {
  if (!postgresStoresPromise) {
    postgresStoresPromise = import("@/lib/server/postgresStore").catch(
      (error) => {
        // Reset so a transient failure can be retried on the next request
        // instead of poisoning every subsequent call with a rejected promise.
        postgresStoresPromise = null;
        throw error;
      },
    );
  }
  return postgresStoresPromise;
}

// --- Public async store (the routes use this) ------------------------------

export const serverEventStore = {
  async save(event: HealthEvent): Promise<void> {
    if (isPostgresConfigured()) {
      const { pgEventStore } = await loadPostgresStores();
      return pgEventStore.save(event);
    }
    return inMemoryEventStore.save(event);
  },

  async list(patientId: string): Promise<HealthEvent[]> {
    if (isPostgresConfigured()) {
      const { pgEventStore } = await loadPostgresStores();
      return pgEventStore.list(patientId);
    }
    return inMemoryEventStore.list(patientId);
  },

  async get(eventId: string): Promise<HealthEvent | undefined> {
    if (isPostgresConfigured()) {
      const { pgEventStore } = await loadPostgresStores();
      return pgEventStore.get(eventId);
    }
    return inMemoryEventStore.get(eventId);
  },
};

export const serverLabFileStore = {
  async save(file: StoredLabFile): Promise<void> {
    if (isPostgresConfigured()) {
      const { pgLabFileStore } = await loadPostgresStores();
      return pgLabFileStore.save(file);
    }
    return inMemoryLabFileStore.save(file);
  },

  async get(reportId: string): Promise<StoredLabFile | undefined> {
    if (isPostgresConfigured()) {
      const { pgLabFileStore } = await loadPostgresStores();
      return pgLabFileStore.get(reportId);
    }
    return inMemoryLabFileStore.get(reportId);
  },
};