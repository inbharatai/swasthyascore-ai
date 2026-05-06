import type { Language } from "@/lib/i18n";
import { translate } from "@/lib/i18n";
import type {
  AiExplanationResult,
  NormalizedHealthInput,
  ScreeningResult,
} from "@/lib/types/health";
import { formatDecimal } from "@/lib/utils/formatting";
import { buildDeterministicReferralNote } from "@/lib/utils/report";
import { MeasurementCard } from "./MeasurementCard";
import { RecommendationCard } from "./RecommendationCard";
import { ReferralNoteCard } from "./ReferralNoteCard";
import { RiskGauge } from "./RiskGauge";
import { ShareReportButtons } from "./ShareReportButtons";

interface ResultScreenProps {
  language: Language;
  inputSnapshot: NormalizedHealthInput | null;
  result: ScreeningResult | null;
  aiExplanation: AiExplanationResult | null;
  aiError: string | null;
  aiLoading: boolean;
  online: boolean;
  reportContent: string | null;
  onGenerateExplanation: () => void;
}

function riskTone(level: ScreeningResult["overallRisk"]["riskLevel"]) {
  if (level === "LOW") return "low";
  if (level === "MODERATE") return "moderate";
  if (level === "HIGH") return "high";
  return "urgent";
}

export function ResultScreen({
  language,
  inputSnapshot,
  result,
  aiExplanation,
  aiError,
  aiLoading,
  online,
  reportContent,
  onGenerateExplanation,
}: ResultScreenProps) {
  if (!result || !inputSnapshot) {
    return (
      <section className="rounded-[34px] border border-white/70 bg-white/95 p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--brand-700)]">
          {translate(language, "section.results")}
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--slate-950)]">
          {translate(language, "result.noData")}
        </h2>
        <p className="mt-3 text-sm leading-6 text-[var(--slate-600)]">
          {translate(language, "report.noResultDescription")}
        </p>
      </section>
    );
  }

  const referralNote =
    aiExplanation?.doctorReferralNote ??
    buildDeterministicReferralNote(language, inputSnapshot, result);
  const reasons = result.overallRisk.reasonKeys.map((key) =>
    translate(language, key),
  );
  const nextSteps = result.overallRisk.nextStepKeys.map((key) =>
    translate(language, key),
  );
  const adviceItems =
    aiExplanation?.lifestyleAdvice.length ? aiExplanation.lifestyleAdvice : nextSteps;

  return (
    <section id="results" className="space-y-5">
      <RiskGauge language={language} riskLevel={result.overallRisk.riskLevel} />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <MeasurementCard
          title={translate(language, "bmi.title")}
          value={formatDecimal(result.bmi.bmi, language)}
          subtitle={translate(language, result.bmi.categoryKey)}
          note={translate(language, result.bmi.noteKey)}
          tone={riskTone(result.overallRisk.riskLevel)}
        />
        <MeasurementCard
          title={translate(language, "waist.title")}
          value={`${formatDecimal(inputSnapshot.waistCm, language)} ${translate(language, "form.units.cm")}`}
          subtitle={translate(language, result.waistRisk.messageKey)}
          note={translate(language, result.waistRisk.noteKey)}
          tone={result.waistRisk.increasedRisk ? "moderate" : "low"}
        />
        {result.waistHeightRatio.ratio != null ? (
          <MeasurementCard
            title={translate(language, "whtr.label")}
            value={formatDecimal(result.waistHeightRatio.ratio, language, 2)}
            subtitle={translate(language, result.waistHeightRatio.riskKey)}
            note={translate(language, "whtr.note")}
            tone={
              result.waistHeightRatio.riskLevel === "high"
                ? "high"
                : result.waistHeightRatio.riskLevel === "increased"
                  ? "moderate"
                  : "low"
            }
          />
        ) : null}
        <MeasurementCard
          title={translate(language, "idrs.title")}
          value={formatDecimal(result.diabetesRisk.score, language, 0)}
          subtitle={translate(language, result.diabetesRisk.categoryKey)}
          note={translate(language, result.diabetesRisk.noteKey)}
          tone={
            result.diabetesRisk.category === "high"
              ? "high"
              : result.diabetesRisk.category === "moderate"
                ? "moderate"
                : "low"
          }
        />
        <MeasurementCard
          title={translate(language, "bp.title")}
          value={
            inputSnapshot.systolicBp == null && inputSnapshot.diastolicBp == null
              ? translate(language, "common.na")
              : `${inputSnapshot.systolicBp ?? "-"} / ${inputSnapshot.diastolicBp ?? "-"}`
          }
          subtitle={translate(language, result.bpRisk.labelKey)}
          note={translate(language, result.bpRisk.noteKey)}
          tone={
            result.bpRisk.status === "urgent"
              ? "urgent"
              : result.bpRisk.status === "high"
                ? "high"
                : result.bpRisk.status === "elevated"
                  ? "moderate"
                  : "low"
          }
        />
        <MeasurementCard
          title={translate(language, "lab.title")}
          value={translate(language, result.labInterpretation.summaryKey)}
          subtitle={
            result.labInterpretation.entries.length > 0
              ? result.labInterpretation.entries
                  .map((entry) => {
                    const label =
                      entry.name === "hba1c"
                        ? translate(language, "form.hba1c")
                        : entry.name === "fastingGlucose"
                          ? translate(language, "form.fasting")
                          : translate(language, "form.random");
                    return `${label}: ${entry.value}`;
                  })
                  .join(" | ")
              : translate(language, "lab.none")
          }
          note={translate(language, result.labInterpretation.noteKey)}
          tone={
            result.labInterpretation.hasDiabetesRangeValue
              ? "high"
              : result.labInterpretation.hasPrediabetesRangeValue
                ? "moderate"
                : "low"
          }
        />
      </div>

      <div className="flex flex-wrap gap-3">
        {result.overallRisk.labTestingRecommended ? (
          <span className="rounded-full bg-amber-100 px-4 py-2 text-xs font-bold text-amber-800">
            {translate(language, "result.labTestingRecommended")}
          </span>
        ) : null}
        {result.overallRisk.doctorReferralNeeded ? (
          <span className="rounded-full bg-orange-100 px-4 py-2 text-xs font-bold text-orange-800">
            {translate(language, "result.doctorReferralNeeded")}
          </span>
        ) : null}
        {result.overallRisk.emergencyWarning ? (
          <span className="rounded-full bg-rose-100 px-4 py-2 text-xs font-bold text-rose-800">
            {translate(language, "result.emergencyWarning")}
          </span>
        ) : null}
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <RecommendationCard
          title={translate(language, "result.reasonsTitle")}
          items={
            reasons.length > 0
              ? reasons
              : [translate(language, "next.healthyHabits")]
          }
          tone={result.overallRisk.emergencyWarning ? "alert" : "soft"}
        />
        <RecommendationCard
          title={translate(language, "result.nextStepsTitle")}
          items={nextSteps}
          tone={result.overallRisk.emergencyWarning ? "alert" : "soft"}
        />
      </div>

      <section className="rounded-[34px] border border-white/70 bg-white/95 p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--brand-700)]">
              {translate(language, "common.ai")}
            </p>
            <h3 className="mt-2 text-xl font-semibold text-[var(--slate-950)]">
              {translate(language, "ai.explainTitle")}
            </h3>
            <p className="mt-2 text-sm leading-6 text-[var(--slate-600)]">
              {translate(language, "ai.explainDescription")}
            </p>
          </div>
          <button
            type="button"
            onClick={onGenerateExplanation}
            disabled={aiLoading || !online}
            className="inline-flex min-h-12 items-center justify-center rounded-full bg-[var(--brand-700)] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--brand-800)] disabled:cursor-not-allowed disabled:bg-[var(--slate-400)]"
          >
            {translate(
              language,
              aiLoading ? "ai.explainLoading" : "ai.explainButton",
            )}
          </button>
        </div>

        {!online ? (
          <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {translate(language, "ai.explainOffline")}
          </p>
        ) : null}
        {aiError ? (
          <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {aiError}
          </p>
        ) : null}

        <div className="mt-5 grid gap-5 xl:grid-cols-2">
          <RecommendationCard
            title={translate(language, "ai.summaryTitle")}
            items={[
              aiExplanation?.summary ?? translate(language, "ai.explainFallback"),
              aiExplanation?.simpleExplanation ??
                translate(language, "fallback.explanation"),
            ]}
          />
          <RecommendationCard
            title={translate(language, "ai.lifestyleAdvice")}
            items={adviceItems}
          />
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <ReferralNoteCard
          language={language}
          note={referralNote}
          isAiEnhanced={Boolean(aiExplanation?.doctorReferralNote)}
        />
        <section className="rounded-[30px] border border-white/70 bg-white/95 p-5 shadow-sm">
          <h3 className="text-xl font-semibold text-[var(--slate-950)]">
            {translate(language, "report.shareTitle")}
          </h3>
          <p className="mt-2 text-sm leading-6 text-[var(--slate-600)]">
            {translate(language, "report.shareDescription")}
          </p>
          <div className="mt-5">
            {reportContent ? (
              <ShareReportButtons language={language} content={reportContent} />
            ) : null}
          </div>
        </section>
      </div>
    </section>
  );
}
