import type { HealthEvent, SyncStatus } from "./types";
import { LocalMemory, InMemoryStore } from "./memory";

/**
 * HealthEventStore — the local persistence interface for health events.
 *
 * Cloud-first for now (events are POSTed to /api/v1/health-events), but the
 * interface is ready for the future offline-first UnoOne Edge layer: every
 * event carries `synced_at` so a later sync pass can replay anything that was
 * captured while offline.
 */
export interface HealthEventStore {
  save(event: HealthEvent): void;
  list(patientId: string): HealthEvent[];
  get(eventId: string): HealthEvent | undefined;
  markSynced(eventId: string, syncedAt: string): void;
}

/**
 * OfflineQueue — holds events captured while offline and replays them when the
 * network returns. The real sync transport lives in the SwasthyakAdapter; this
 * queue only owns ordering + retry bookkeeping.
 */
export interface OfflineQueue {
  enqueue(event: HealthEvent): void;
  pending(): HealthEvent[];
  flush(syncFn: (event: HealthEvent) => Promise<void>): Promise<void>;
}

/* -------------------------------------------------------------------------- */
/* In-memory implementations (server + tests)                                 */
/* -------------------------------------------------------------------------- */

export class InMemoryHealthEventStore implements HealthEventStore {
  private readonly store = new InMemoryStore<HealthEvent>();

  save(event: HealthEvent): void {
    this.store.set(event.event_id, event);
  }

  list(patientId: string): HealthEvent[] {
    return this.store
      .values()
      .filter((event) => event.patient_id === patientId)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
  }

  get(eventId: string): HealthEvent | undefined {
    return this.store.get(eventId);
  }

  markSynced(eventId: string, syncedAt: string): void {
    const event = this.store.get(eventId);
    if (event) {
      this.store.set(eventId, { ...event, synced_at: syncedAt });
    }
  }
}

export class InMemoryOfflineQueue implements OfflineQueue {
  private readonly statuses = new Map<string, SyncStatus>();
  private readonly ordered: HealthEvent[] = [];

  enqueue(event: HealthEvent): void {
    if (this.statuses.get(event.event_id) === "pending") return;
    this.statuses.set(event.event_id, "pending");
    this.ordered.push(event);
  }

  pending(): HealthEvent[] {
    return this.ordered.filter(
      (event) => this.statuses.get(event.event_id) === "pending",
    );
  }

  async flush(syncFn: (event: HealthEvent) => Promise<void>): Promise<void> {
    for (const event of this.pending()) {
      try {
        await syncFn(event);
        this.statuses.set(event.event_id, "synced");
      } catch {
        this.statuses.set(event.event_id, "failed");
      }
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Browser (localStorage) implementations                                      */
/* -------------------------------------------------------------------------- */

export class LocalStorageHealthEventStore implements HealthEventStore {
  constructor(private readonly patientId: string) {}

  save(event: HealthEvent): void {
    const all = this.readAll();
    all[event.event_id] = event;
    this.writeAll(all);
  }

  list(patientId: string): HealthEvent[] {
    return Object.values(this.readAll())
      .filter((event) => event.patient_id === patientId)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
  }

  get(eventId: string): HealthEvent | undefined {
    return this.readAll()[eventId];
  }

  markSynced(eventId: string, syncedAt: string): void {
    const all = this.readAll();
    if (all[eventId]) {
      all[eventId] = { ...all[eventId], synced_at: syncedAt };
      this.writeAll(all);
    }
  }

  private readAll(): Record<string, HealthEvent> {
    return LocalMemory.read<Record<string, HealthEvent>>(
      this.patientId,
      "events",
      {},
    );
  }

  private writeAll(events: Record<string, HealthEvent>): void {
    LocalMemory.write(this.patientId, "events", events);
  }
}

export class LocalStorageOfflineQueue implements OfflineQueue {
  constructor(private readonly patientId: string) {}

  enqueue(event: HealthEvent): void {
    const queue = this.readQueue();
    if (!queue.some((item) => item.event_id === event.event_id)) {
      queue.push(event);
    }
    this.writeQueue(queue);
  }

  pending(): HealthEvent[] {
    return this.readQueue();
  }

  async flush(syncFn: (event: HealthEvent) => Promise<void>): Promise<void> {
    const queue = this.readQueue();
    const remaining: HealthEvent[] = [];
    for (const event of queue) {
      try {
        await syncFn(event);
      } catch {
        remaining.push(event);
      }
    }
    this.writeQueue(remaining);
  }

  private readQueue(): HealthEvent[] {
    return LocalMemory.read<HealthEvent[]>(this.patientId, "offline-queue", []);
  }

  private writeQueue(queue: HealthEvent[]): void {
    LocalMemory.write(this.patientId, "offline-queue", queue);
  }
}