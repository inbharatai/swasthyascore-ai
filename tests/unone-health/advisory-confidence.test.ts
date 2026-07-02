import { describe, expect, it } from "vitest";
import { deriveAdvisoryConfidence } from "@/modules/unone-health/health-skills/lifestyle-plan";

describe("deriveAdvisoryConfidence", () => {
  it("is 0.5 with no evidence (the floor)", () => {
    expect(deriveAdvisoryConfidence({})).toBe(0.5);
  });

  it("grows as more evidence sources are supplied", () => {
    const empty = deriveAdvisoryConfidence({});
    const profileOnly = deriveAdvisoryConfidence({
      profile: { age: 50, sex: "male", bmi: 27 },
    });
    const withLabs = deriveAdvisoryConfidence({
      profile: { age: 50, sex: "male", bmi: 27 },
      labReport: { markers: [] },
    });
    const full = deriveAdvisoryConfidence({
      profile: { age: 50, sex: "male", bmi: 27 },
      labReport: { markers: [] },
      vitals: { heart_rate_bpm: 72 },
      symptoms: { severity: "mild", red_flags: [] },
    });
    expect(profileOnly).toBeGreaterThan(empty);
    expect(withLabs).toBeGreaterThan(profileOnly);
    expect(full).toBeGreaterThan(withLabs);
  });

  it("caps at 0.9 for a fully-evidenced, non-emergency advisory", () => {
    const c = deriveAdvisoryConfidence({
      profile: { age: 50, sex: "male", bmi: 27 },
      labReport: { markers: [] },
      vitals: { heart_rate_bpm: 72 },
      symptoms: { severity: "mild", red_flags: [] },
    });
    expect(c).toBeLessThanOrEqual(0.9);
    expect(c).toBeGreaterThanOrEqual(0.85);
  });

  it("caps LOW (<=0.7) when red flags are present (no false assurance in emergencies)", () => {
    const c = deriveAdvisoryConfidence({
      profile: { age: 50, sex: "male", bmi: 27 },
      labReport: { markers: [] },
      vitals: { heart_rate_bpm: 72 },
      symptoms: { severity: "severe", red_flags: ["chest pain"] },
    });
    expect(c).toBeLessThanOrEqual(0.7);
  });

  it("caps LOW (<=0.7) on severe symptoms even without explicit red flags", () => {
    const c = deriveAdvisoryConfidence({
      profile: { age: 50, sex: "male", bmi: 27 },
      labReport: { markers: [] },
      symptoms: { severity: "severe", red_flags: [] },
    });
    expect(c).toBeLessThanOrEqual(0.7);
  });

  it("never drops below 0.5 or above 0.9", () => {
    expect(deriveAdvisoryConfidence({})).toBeGreaterThanOrEqual(0.5);
    expect(
      deriveAdvisoryConfidence({
        profile: { age: 50, sex: "male", bmi: 27 },
        labReport: { markers: [] },
        vitals: { heart_rate_bpm: 72 },
        symptoms: { severity: "mild", red_flags: [] },
      }),
    ).toBeLessThanOrEqual(0.9);
  });

  it("lab report contributes more than symptoms alone (objective > subjective)", () => {
    const labOnly = deriveAdvisoryConfidence({ labReport: { markers: [] } });
    const symptomsOnly = deriveAdvisoryConfidence({
      symptoms: { severity: "mild", red_flags: [] },
    });
    expect(labOnly).toBeGreaterThan(symptomsOnly);
  });
});