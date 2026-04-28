import type { BpRiskResult } from "@/lib/types/health";

export function calculateBpRisk(
  systolicBp: number | null,
  diastolicBp: number | null,
): BpRiskResult {
  if (systolicBp == null && diastolicBp == null) {
    return {
      status: "unknown",
      labelKey: "bp.unknown",
      noteKey: "bp.note",
      incompleteReading: false,
    };
  }

  const incompleteReading = systolicBp == null || diastolicBp == null;

  if (
    (systolicBp != null && systolicBp >= 180) ||
    (diastolicBp != null && diastolicBp >= 120)
  ) {
    return {
      status: "urgent",
      labelKey: "bp.urgent",
      noteKey: "bp.note",
      incompleteReading,
    };
  }

  if (
    (systolicBp != null && systolicBp >= 140) ||
    (diastolicBp != null && diastolicBp >= 90)
  ) {
    return {
      status: "high",
      labelKey: "bp.high",
      noteKey: "bp.note",
      incompleteReading,
    };
  }

  if (
    (systolicBp != null && systolicBp >= 130) ||
    (diastolicBp != null && diastolicBp >= 80)
  ) {
    return {
      status: "elevated",
      labelKey: "bp.elevated",
      noteKey: "bp.note",
      incompleteReading,
    };
  }

  return {
    status: "normal",
    labelKey: "bp.normal",
    noteKey: "bp.note",
    incompleteReading,
  };
}
