import { describe, expect, it } from "vitest";
import { createUnoOneHealthRuntime } from "@/lib/unone-health";
import { InMemoryHealthEventStore } from "@/modules/unone-health/core/offlineQueue";
import type { HealthEvent, SymptomEvent, ToolContext } from "@/modules/unone-health/core/types";
import { healthEventSchema } from "@/modules/unone-health/core/types";

const FIXED_NOW = "2026-07-01T00:00:00.000Z";

function makeContext(events: ToolContext["events"]): Omit<ToolContext, "consent"> {
  return { patientId: "p-1", online: true, now: () => FIXED_NOW, events };
}

function baseEvent(overrides: Partial<HealthEvent> = {}): HealthEvent {
  return healthEventSchema.parse({
    event_id: "ev-1",
    patient_id: "p-1",
    source: "unone_health",
    event_type: "vital_scan",
    confidence: 0.8,
    payload: {},
    privacy: { consent_given: true, raw_video_uploaded: false, raw_report_uploaded: false },
    safety: { diagnosis_claimed: false, medicine_prescribed: false },
    created_at: FIXED_NOW,
    synced_at: null,
    ...overrides,
  });
}

describe("symptom collect tool", () => {
  it("flags emergency red flags as severe and saves an event", async () => {
    const runtime = createUnoOneHealthRuntime();
    const store = new InMemoryHealthEventStore();
    const event = await runtime.invoke<SymptomEvent>("health.symptoms.collect", {
      patient_id: "p-1",
      text: "I have chest pain and severe breathlessness since this morning.",
      source: "text",
    }, makeContext(store));

    expect(event.severity).toBe("severe");
    expect(event.red_flags.length).toBeGreaterThan(0);
    expect(event.summary).toContain("not a diagnosis");
    expect(store.list("p-1").length).toBeGreaterThan(0);
  });

  it("does not produce a diagnosis or prescription", async () => {
    const runtime = createUnoOneHealthRuntime();
    const event = await runtime.invoke<SymptomEvent>("health.symptoms.collect", {
      patient_id: "p-1",
      text: "Mild headache and fatigue for two days.",
      source: "text",
    }, makeContext(new InMemoryHealthEventStore()));

    expect(event.summary).not.toContain("you have");
    expect(event.summary).not.toMatch(/take \d+ ?mg/i);
  });
});

describe("record save safety contract", () => {
  it("rejects a HealthEvent that tries to upload raw face video", async () => {
    const runtime = createUnoOneHealthRuntime();
    const store = new InMemoryHealthEventStore();
    const bad = baseEvent({
      event_id: "ev-raw",
      privacy: { consent_given: true, raw_video_uploaded: true, raw_report_uploaded: false },
    });
    await expect(
      runtime.invoke("health.record.save", bad, makeContext(store)),
    ).rejects.toThrow(/raw face video/i);
  });

  it("rejects a HealthEvent that claims a diagnosis (schema-level)", async () => {
    const runtime = createUnoOneHealthRuntime();
    const store = new InMemoryHealthEventStore();
    const bad = {
      ...baseEvent(),
      safety: { diagnosis_claimed: true, medicine_prescribed: false },
    };
    await expect(
      runtime.invoke("health.record.save", bad, makeContext(store)),
    ).rejects.toThrow();
  });

  it("saves a clean event and marks it synced when online", async () => {
    const runtime = createUnoOneHealthRuntime();
    const store = new InMemoryHealthEventStore();
    const clean = baseEvent({ event_id: "ev-clean" });
    const saved = await runtime.invoke<HealthEvent>("health.record.save", clean, makeContext(store));
    expect(saved.synced_at).toBe(FIXED_NOW);
    expect(store.get("ev-clean")).toBeDefined();
  });
});

describe("sync queue tool", () => {
  it("is a no-op when offline", async () => {
    const runtime = createUnoOneHealthRuntime();
    const store = new InMemoryHealthEventStore();
    const result = await runtime.invoke<{ online: boolean; flushed: number; remaining: number }>(
      "health.sync.queue",
      { patient_id: "p-1", force: false },
      { ...makeContext(store), online: false },
    );
    expect(result.online).toBe(false);
    expect(result.flushed).toBe(0);
  });
});