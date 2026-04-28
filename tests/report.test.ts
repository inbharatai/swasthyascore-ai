import { describe, expect, it } from "vitest";
import { calculateScreeningResult } from "@/lib/calculators/overallRisk";
import type { NormalizedHealthInput } from "@/lib/types/health";
import {
  buildDeterministicReferralNote,
  buildReportText,
} from "@/lib/utils/report";

const input: NormalizedHealthInput = {
  name: "Asha",
  age: 52,
  gender: "female",
  heightCm: 160,
  weightKg: 74,
  waistCm: 91,
  systolicBp: 142,
  diastolicBp: 92,
  physicalActivity: "moderate",
  familyHistory: "one_parent",
  symptoms: ["fatigue"],
  notes: "",
  hba1c: 6.8,
  fastingGlucose: null,
  randomGlucose: null,
};

describe("screening report text", () => {
  it("includes deterministic results, next steps, referral note, and disclaimer", () => {
    const result = calculateScreeningResult(input);
    const referralNote = buildDeterministicReferralNote("en", input, result);
    const report = buildReportText({
      language: "en",
      formData: input,
      result,
      referralNote,
      generatedAt: new Date("2026-04-28T06:30:00.000Z"),
    });

    expect(report).toContain("SwasthyaScore AI screening report");
    expect(report).toContain("Overall risk");
    expect(report).toContain("High screening risk");
    expect(report).toContain("Doctor review and confirmation testing are recommended.");
    expect(report).toContain("It does not diagnose disease or replace a doctor.");
  });
});
