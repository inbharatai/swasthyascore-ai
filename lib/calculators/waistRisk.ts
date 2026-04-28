import type { Gender, WaistRiskResult } from "@/lib/types/health";

export function calculateWaistRisk(
  gender: Gender,
  waistCm: number,
): WaistRiskResult {
  const thresholdCm = gender === "male" ? 90 : 80;
  const increasedRisk = waistCm > thresholdCm;

  return {
    increasedRisk,
    thresholdCm,
    messageKey: increasedRisk ? "waist.increased" : "waist.safe",
    noteKey: "waist.note",
  };
}
