import { describe, expect, it } from "vitest";
import {
  interpretFastingGlucose,
  interpretHba1c,
  interpretLabValues,
  interpretRandomGlucose,
} from "@/lib/calculators/labInterpretation";

describe("lab interpretation", () => {
  it("classifies HbA1c 6.8 in the diabetes range", () => {
    const result = interpretHba1c(6.8);

    expect(result.status).toBe("diabetes");
    expect(result.labelKey).toBe("lab.value.diabetes");
  });

  it("classifies fasting glucose 130 in the diabetes range", () => {
    const result = interpretFastingGlucose(130);

    expect(result.status).toBe("diabetes");
  });

  it("treats random glucose 220 as diabetes-range concern", () => {
    const result = interpretRandomGlucose(220);

    expect(result.status).toBe("diabetes");
  });

  it("summarizes cautious random glucose separately from normal labs", () => {
    const result = interpretLabValues({
      hba1c: null,
      fastingGlucose: null,
      randomGlucose: 150,
    });

    expect(result.summaryKey).toBe("lab.summary.caution");
    expect(result.hasDiabetesRangeValue).toBe(false);
  });
});
