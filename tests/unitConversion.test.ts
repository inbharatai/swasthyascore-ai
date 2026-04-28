import { describe, expect, it } from "vitest";
import {
  cmToFeetInches,
  feetInchesToCm,
  kgToPounds,
  poundsToKg,
  roundOneDecimal,
} from "@/lib/utils/units";

describe("measurement unit conversion", () => {
  it("converts feet and inches to centimeters for BMI input", () => {
    expect(roundOneDecimal(feetInchesToCm(5, 8))).toBe(172.7);
  });

  it("converts centimeters back to feet and inches for editing", () => {
    expect(cmToFeetInches(172.7)).toEqual({ feet: 5, inches: 8 });
  });

  it("converts pounds to kilograms for deterministic calculation", () => {
    expect(roundOneDecimal(poundsToKg(154))).toBe(69.9);
  });

  it("converts kilograms back to pounds for the input helper", () => {
    expect(roundOneDecimal(kgToPounds(70))).toBe(154.3);
  });
});
