import type { TranslationKey } from "@/lib/i18n";
import type { WaistHeightRatioResult } from "@/lib/types/health";

export function calculateWHtR(
  waistCm: number,
  heightCm: number,
): WaistHeightRatioResult {
  if (heightCm <= 0) {
    return {
      ratio: null,
      riskLevel: "unknown",
      riskKey: "whtr.unknown",
      labelKey: "whtr.label",
    };
  }

  const ratio = waistCm / heightCm;

  let riskLevel: WaistHeightRatioResult["riskLevel"];
  let riskKey: TranslationKey;

  if (ratio < 0.4) {
    riskLevel = "underweight_risk";
    riskKey = "whtr.underweight_risk";
  } else if (ratio < 0.5) {
    riskLevel = "healthy";
    riskKey = "whtr.healthy";
  } else if (ratio < 0.6) {
    riskLevel = "increased";
    riskKey = "whtr.increased";
  } else {
    riskLevel = "high";
    riskKey = "whtr.high";
  }

  return {
    ratio,
    riskLevel,
    riskKey,
    labelKey: "whtr.label",
  };
}
