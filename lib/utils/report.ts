import { formatDateTime, formatDecimal, joinLines, toSentenceList } from "@/lib/utils/formatting";
import { getDictionary, translate, type Language } from "@/lib/i18n";
import type {
  AiExplanationResult,
  NormalizedHealthInput,
  ScreeningResult,
} from "@/lib/types/health";

function genderLabel(language: Language, gender: NormalizedHealthInput["gender"]) {
  return translate(language, gender === "male" ? "form.male" : "form.female");
}

function activityLabel(
  language: Language,
  activity: NormalizedHealthInput["physicalActivity"],
) {
  const keyMap = {
    regular_active: "activity.regularActive",
    moderate: "activity.moderate",
    sedentary: "activity.sedentary",
  } as const;

  return translate(language, keyMap[activity]);
}

function familyHistoryLabel(
  language: Language,
  history: NormalizedHealthInput["familyHistory"],
) {
  const keyMap = {
    none: "family.none",
    one_parent: "family.oneParent",
    both_parents: "family.bothParents",
  } as const;

  return translate(language, keyMap[history]);
}

function symptomLabel(
  language: Language,
  symptom: NormalizedHealthInput["symptoms"][number],
) {
  const keyMap = {
    frequent_urination: "symptom.frequentUrination",
    excessive_thirst: "symptom.excessiveThirst",
    unexplained_weight_loss: "symptom.unexplainedWeightLoss",
    blurred_vision: "symptom.blurredVision",
    fatigue: "symptom.fatigue",
    slow_wound_healing: "symptom.slowWoundHealing",
    none: "symptom.none",
  } as const;

  return translate(language, keyMap[symptom]);
}

export function buildDeterministicReferralNote(
  language: Language,
  input: NormalizedHealthInput,
  result: ScreeningResult,
): string {
  const riskLevel = result.overallRisk.riskLevel;

  const baseKey =
    riskLevel === "URGENT"
      ? "fallback.referralUrgent"
      : riskLevel === "HIGH"
        ? "fallback.referralHigh"
        : riskLevel === "MODERATE"
          ? "fallback.referralModerate"
          : "fallback.referralLow";

  const lines = [
    translate(language, baseKey),
    result.overallRisk.doctorReferralNeeded
      ? translate(language, "next.doctorSoon")
      : translate(language, "fallback.noReferralNeeded"),
    result.overallRisk.emergencyWarning
      ? translate(language, "next.urgentCare")
      : "",
    input.notes ?? "",
  ];

  return lines.filter(Boolean).join(" ");
}

export function buildFallbackExplanation(
  language: Language,
  result: ScreeningResult,
): string {
  const reasons = result.overallRisk.reasonKeys.map((key) => translate(language, key));
  const nextSteps = result.overallRisk.nextStepKeys.map((key) =>
    translate(language, key),
  );

  return toSentenceList([
    translate(language, "fallback.explanation"),
    reasons.join(" "),
    nextSteps.join(" "),
  ]);
}

export function buildReportText(input: {
  language: Language;
  formData: NormalizedHealthInput;
  result: ScreeningResult;
  aiExplanation?: AiExplanationResult | null;
  referralNote: string;
  generatedAt?: Date;
}): string {
  const { language, formData, result, aiExplanation, referralNote } = input;
  const generatedAt = input.generatedAt ?? new Date();
  const dictionary = getDictionary(language);

  const symptomText =
    formData.symptoms.length > 0
      ? formData.symptoms.map((item) => symptomLabel(language, item)).join(", ")
      : dictionary["fallback.symptomsNone"];

  const labLines = result.labInterpretation.entries.map((entry) => {
    const label =
      entry.name === "hba1c"
        ? dictionary["form.hba1c"]
        : entry.name === "fastingGlucose"
          ? dictionary["form.fasting"]
          : dictionary["form.random"];
    return `${label}: ${formatDecimal(entry.value, language)} - ${translate(
      language,
      entry.labelKey,
    )}`;
  });

  const aiLines = aiExplanation
    ? [
        `${dictionary["ai.summaryTitle"]}: ${aiExplanation.summary}`,
        `${dictionary["ai.referralTitle"]}: ${aiExplanation.doctorReferralNote}`,
      ]
    : [];

  return joinLines([
    dictionary["report.title"],
    `${dictionary["report.generated"]}: ${formatDateTime(generatedAt, language)}`,
    "",
    dictionary["report.inputs"],
    `${dictionary["form.name"]}: ${formData.name ?? dictionary["common.na"]}`,
    `${dictionary["form.age"]}: ${formatDecimal(formData.age, language, 0)}`,
    `${dictionary["form.gender"]}: ${genderLabel(language, formData.gender)}`,
    `${dictionary["form.height"]}: ${formatDecimal(formData.heightCm, language)} ${dictionary["form.units.cm"]}`,
    `${dictionary["form.weight"]}: ${formatDecimal(formData.weightKg, language)} ${dictionary["form.units.kg"]}`,
    `${dictionary["form.waist"]}: ${formatDecimal(formData.waistCm, language)} ${dictionary["form.units.cm"]}`,
    `${dictionary["form.systolic"]}: ${formData.systolicBp == null ? dictionary["common.na"] : `${formatDecimal(formData.systolicBp, language, 0)} ${dictionary["form.units.mmhg"]}`}`,
    `${dictionary["form.diastolic"]}: ${formData.diastolicBp == null ? dictionary["common.na"] : `${formatDecimal(formData.diastolicBp, language, 0)} ${dictionary["form.units.mmhg"]}`}`,
    `${dictionary["form.activity"]}: ${activityLabel(language, formData.physicalActivity)}`,
    `${dictionary["form.familyHistory"]}: ${familyHistoryLabel(language, formData.familyHistory)}`,
    `${dictionary["form.symptoms"]}: ${symptomText}`,
    formData.notes ? `${dictionary["form.notes"]}: ${formData.notes}` : "",
    formData.hba1c != null
      ? `${dictionary["form.hba1c"]}: ${formatDecimal(formData.hba1c, language)} ${dictionary["form.units.percent"]}`
      : "",
    formData.fastingGlucose != null
      ? `${dictionary["form.fasting"]}: ${formatDecimal(formData.fastingGlucose, language, 0)} ${dictionary["form.units.mgdl"]}`
      : "",
    formData.randomGlucose != null
      ? `${dictionary["form.random"]}: ${formatDecimal(formData.randomGlucose, language, 0)} ${dictionary["form.units.mgdl"]}`
      : "",
    "",
    dictionary["report.results"],
    `${dictionary["bmi.title"]}: ${formatDecimal(result.bmi.bmi, language)} - ${translate(language, result.bmi.categoryKey)}`,
    `${dictionary["waist.title"]}: ${translate(language, result.waistRisk.messageKey)}`,
    result.waistHeightRatio.ratio != null
      ? `${dictionary["whtr.label"]}: ${formatDecimal(result.waistHeightRatio.ratio, language, 2)} - ${translate(language, result.waistHeightRatio.riskKey)}`
      : "",
    `${dictionary["idrs.title"]}: ${formatDecimal(result.diabetesRisk.score, language, 0)} - ${translate(language, result.diabetesRisk.categoryKey)}`,
    `${dictionary["bp.title"]}: ${translate(language, result.bpRisk.labelKey)}`,
    `${dictionary["lab.title"]}: ${translate(language, result.labInterpretation.summaryKey)}`,
    ...labLines,
    `${dictionary["overall.title"]}: ${translate(language, result.overallRisk.riskKey)}`,
    "",
    dictionary["report.nextSteps"],
    ...result.overallRisk.nextStepKeys.map((key) => `- ${translate(language, key)}`),
    "",
    dictionary["report.referral"],
    referralNote,
    aiLines.length > 0 ? "" : "",
    ...aiLines,
    "",
    dictionary["report.disclaimer"],
  ].filter(Boolean));
}
