import type { BMIResult } from "@/lib/types/health";

function roundToSingleDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

export function calculateBMI(weightKg: number, heightCm: number): BMIResult {
  const heightM = heightCm / 100;
  const bmi = roundToSingleDecimal(weightKg / (heightM * heightM));

  if (bmi < 18.5) {
    return {
      bmi,
      category: "underweight",
      categoryKey: "bmi.underweight",
      noteKey: "bmi.note",
    };
  }

  if (bmi <= 22.9) {
    return {
      bmi,
      category: "normal",
      categoryKey: "bmi.normal",
      noteKey: "bmi.note",
    };
  }

  if (bmi <= 24.9) {
    return {
      bmi,
      category: "overweight",
      categoryKey: "bmi.overweight",
      noteKey: "bmi.note",
    };
  }

  return {
    bmi,
    category: "obesity",
    categoryKey: "bmi.obesity",
    noteKey: "bmi.note",
  };
}
