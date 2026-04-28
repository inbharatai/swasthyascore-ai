import type {
  LabInterpretationResult,
  LabValueInterpretation,
} from "@/lib/types/health";

export function interpretHba1c(value: number): LabValueInterpretation {
  if (value < 5.7) {
    return { name: "hba1c", value, status: "normal", labelKey: "lab.value.normal" };
  }

  if (value <= 6.4) {
    return {
      name: "hba1c",
      value,
      status: "prediabetes",
      labelKey: "lab.value.prediabetes",
    };
  }

  return {
    name: "hba1c",
    value,
    status: "diabetes",
    labelKey: "lab.value.diabetes",
  };
}

export function interpretFastingGlucose(value: number): LabValueInterpretation {
  if (value <= 99) {
    return {
      name: "fastingGlucose",
      value,
      status: "normal",
      labelKey: "lab.value.normal",
    };
  }

  if (value <= 125) {
    return {
      name: "fastingGlucose",
      value,
      status: "prediabetes",
      labelKey: "lab.value.prediabetes",
    };
  }

  return {
    name: "fastingGlucose",
    value,
    status: "diabetes",
    labelKey: "lab.value.diabetes",
  };
}

export function interpretRandomGlucose(value: number): LabValueInterpretation {
  if (value >= 200) {
    return {
      name: "randomGlucose",
      value,
      status: "diabetes",
      labelKey: "lab.value.diabetes",
    };
  }

  return {
    name: "randomGlucose",
    value,
    status: "cautious",
    labelKey: "lab.value.cautious",
  };
}

export function interpretLabValues(values: {
  hba1c: number | null;
  fastingGlucose: number | null;
  randomGlucose: number | null;
}): LabInterpretationResult {
  const entries: LabValueInterpretation[] = [];

  if (values.hba1c != null) {
    entries.push(interpretHba1c(values.hba1c));
  }

  if (values.fastingGlucose != null) {
    entries.push(interpretFastingGlucose(values.fastingGlucose));
  }

  if (values.randomGlucose != null) {
    entries.push(interpretRandomGlucose(values.randomGlucose));
  }

  const hasDiabetesRangeValue = entries.some(
    (entry) => entry.status === "diabetes",
  );
  const hasPrediabetesRangeValue = entries.some(
    (entry) => entry.status === "prediabetes",
  );

  let summaryKey: LabInterpretationResult["summaryKey"] = "lab.none";

  if (entries.length === 0) {
    summaryKey = "lab.none";
  } else if (hasDiabetesRangeValue) {
    summaryKey = "lab.summary.diabetes";
  } else if (hasPrediabetesRangeValue) {
    summaryKey = "lab.summary.prediabetes";
  } else if (entries.some((entry) => entry.status === "cautious")) {
    summaryKey = "lab.summary.caution";
  } else {
    summaryKey = "lab.summary.normal";
  }

  return {
    entries,
    summaryKey,
    noteKey: "lab.note",
    hasAnyValue: entries.length > 0,
    hasPrediabetesRangeValue,
    hasDiabetesRangeValue,
  };
}
