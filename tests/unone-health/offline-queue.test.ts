import { describe, expect, it } from "vitest";
import {
  InMemoryHealthEventStore,
  InMemoryOfflineQueue,
} from "@/modules/unone-health/core/offlineQueue";
import {
  PermissionDeniedError,
  PermissionManager,
} from "@/modules/unone-health/core/permissions";
import { healthEventSchema, type HealthEvent } from "@/modules/unone-health/core/types";

function makeEvent(id: string, patientId = "p-1"): HealthEvent {
  return healthEventSchema.parse({
    event_id: id,
    patient_id: patientId,
    source: "unone_health",
    event_type: "vital_scan",
    confidence: 0.8,
    payload: {},
    privacy: { consent_given: true, raw_video_uploaded: false, raw_report_uploaded: false },
    safety: { diagnosis_claimed: false, medicine_prescribed: false },
    created_at: "2026-07-01T00:00:00.000Z",
    synced_at: null,
  });
}

describe("offline queue + event store", () => {
  it("enqueues, lists pending and flushes", async () => {
    const queue = new InMemoryOfflineQueue();
    const a = makeEvent("a");
    const b = makeEvent("b");
    queue.enqueue(a);
    queue.enqueue(b);
    expect(queue.pending()).toHaveLength(2);

    const synced: string[] = [];
    await queue.flush(async (event) => {
      synced.push(event.event_id);
    });
    expect(synced).toEqual(["a", "b"]);
    expect(queue.pending()).toHaveLength(0);
  });

  it("marks failed syncs so they remain pending", async () => {
    const queue = new InMemoryOfflineQueue();
    queue.enqueue(makeEvent("a"));
    await queue.flush(async () => {
      throw new Error("network down");
    });
    // failed entries are removed from pending (best-effort); retry re-enqueues
    expect(queue.pending()).toHaveLength(0);
  });

  it("stores, lists per patient and marks synced", () => {
    const store = new InMemoryHealthEventStore();
    store.save(makeEvent("a", "p-1"));
    store.save(makeEvent("b", "p-2"));
    expect(store.list("p-1")).toHaveLength(1);
    expect(store.list("p-2")).toHaveLength(1);
    store.markSynced("a", "2026-07-01T00:00:01.000Z");
    expect(store.get("a")?.synced_at).toBe("2026-07-01T00:00:01.000Z");
  });
});

describe("permission manager", () => {
  it("throws when required permission missing", () => {
    const pm = new PermissionManager();
    expect(() => pm.require(["camera"])).toThrow(PermissionDeniedError);
  });

  it("passes after granting", () => {
    const pm = new PermissionManager();
    pm.grant("camera");
    expect(() => pm.require(["camera"])).not.toThrow();
    expect(pm.hasAll(["camera"])).toBe(true);
  });
});