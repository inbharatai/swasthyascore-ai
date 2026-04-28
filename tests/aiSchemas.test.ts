import { describe, expect, it } from "vitest";
import { labOcrResponseSchema, visibleConcernSchema } from "@/lib/ai/schemas";

describe("AI structured output schemas", () => {
  it("validates lab OCR JSON", () => {
    const parsed = labOcrResponseSchema.parse({
      hba1c: 6.1,
      fastingGlucose: null,
      randomGlucose: 180,
      systolicBp: null,
      diastolicBp: null,
      confidence: "medium",
      warnings: ["Unit unclear for one value."],
    });

    expect(parsed.confidence).toBe("medium");
  });

  it("requires visible concern output to be explicitly non-diagnostic", () => {
    expect(() =>
      visibleConcernSchema.parse({
        summary: "Visible concern needs review.",
        visibleConcerns: ["Possible visible wound concern"],
        confidence: "low",
        recommendedAction: ["Ask a health worker or doctor to review."],
        safetyDisclaimer: "This is not a diagnosis.",
        notDiagnosis: true,
      }),
    ).not.toThrow();

    expect(() =>
      visibleConcernSchema.parse({
        summary: "Diagnosis text",
        visibleConcerns: [],
        confidence: "low",
        recommendedAction: [],
        safetyDisclaimer: "",
        notDiagnosis: false,
      }),
    ).toThrow();
  });
});
