import { describe, expect, it } from "vitest";
import {
  healthAdvisorySchema,
  healthEventSchema,
} from "@/modules/unone-health/core/types";
import { enforceHealthAdvisorySafety } from "@/modules/unone-health/health-skills/lifestyle-plan";

const sampleAdvisory = {
  risk_level: "consult_doctor",
  top_findings: [
    {
      title: "High HbA1c",
      why_it_matters: "This marker may suggest risk and should be discussed with a doctor.",
      related_markers: ["HbA1c", "Fasting glucose"],
      recommended_next_step: "Discuss with a doctor",
    },
  ],
  user_message: "One marker may need a doctor's review.",
  follow_up_questions: [],
  repeat_scan_recommended: false,
  doctor_summary: "HbA1c in the diabetes-range; confirm with testing.",
  family_summary: "A sugar marker is a little high — please see a doctor.",
  lifestyle_plan: {
    diet: ["Reduce sugary drinks", "More fibre"],
    activity: ["30 min walk daily"],
    sleep: ["7-8 hours"],
    hydration: ["Drink water regularly"],
    avoid: ["Refined carbs"],
    follow_up: ["Doctor review in 2 weeks"],
  },
  safety_note: "This is AI-assisted interpretation, not a diagnosis. Consult a qualified doctor for medical decisions.",
  diagnosis_claimed: false,
  medicine_prescribed: false,
};

describe("health advisory schema", () => {
  it("validates a well-formed advisory", () => {
    expect(() => healthAdvisorySchema.parse(sampleAdvisory)).not.toThrow();
  });

  it("rejects diagnosis_claimed = true (literal false required)", () => {
    expect(() =>
      healthAdvisorySchema.parse({ ...sampleAdvisory, diagnosis_claimed: true }),
    ).toThrow();
  });

  it("rejects medicine_prescribed = true", () => {
    expect(() =>
      healthAdvisorySchema.parse({ ...sampleAdvisory, medicine_prescribed: true }),
    ).toThrow();
  });

  it("requires all lifestyle_plan sub-arrays", () => {
    const bad = {
      ...sampleAdvisory,
      lifestyle_plan: { ...sampleAdvisory.lifestyle_plan, diet: undefined },
    };
    expect(() => healthAdvisorySchema.parse(bad)).toThrow();
  });
});

describe("advisory safety enforcement", () => {
  it("forces safety flags false and sanitises diagnosis wording", () => {
    const dirty = {
      ...sampleAdvisory,
      user_message: "You have diabetes. Take 500mg metformin twice daily.",
      diagnosis_claimed: false,
      medicine_prescribed: false,
    } as never;
    const safe = enforceHealthAdvisorySafety(dirty);
    expect(safe.diagnosis_claimed).toBe(false);
    expect(safe.medicine_prescribed).toBe(false);
    expect(safe.user_message).not.toContain("You have diabetes");
    expect(safe.user_message).not.toContain("500mg");
    expect(safe.safety_note).toContain("not a diagnosis");
  });
});

describe("canonical HealthEvent schema", () => {
  it("requires privacy + safety envelopes", () => {
    const event = {
      event_id: "ev-1",
      patient_id: "p-1",
      source: "unone_health",
      event_type: "vital_scan",
      confidence: 0.8,
      payload: {},
      privacy: { consent_given: true, raw_video_uploaded: false, raw_report_uploaded: false },
      safety: { diagnosis_claimed: false, medicine_prescribed: false },
      created_at: "2026-07-01T00:00:00.000Z",
      synced_at: null,
    };
    expect(() => healthEventSchema.parse(event)).not.toThrow();
  });
});