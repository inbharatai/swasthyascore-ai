"use client";

import Image from "next/image";
import {
  Activity,
  BrainCircuit,
  Camera,
  FileText,
  HeartPulse,
  Languages,
  MessageCircleHeart,
  PlayCircle,
  ShieldCheck,
} from "lucide-react";
import { startTransition, useEffect, useState } from "react";
import { calculateScreeningResult } from "@/lib/calculators/overallRisk";
import type { Language, TranslationKey } from "@/lib/i18n";
import { translate } from "@/lib/i18n";
import type {
  AiExplanationResult,
  HealthFormChangeHandler,
  HealthFormData,
  NormalizedHealthInput,
  ScreeningResult,
  Symptom,
} from "@/lib/types/health";
import { EMPTY_HEALTH_FORM } from "@/lib/types/health";
import type { AppTab } from "@/lib/types/navigation";
import { buildDeterministicReferralNote, buildReportText } from "@/lib/utils/report";
import { useClientReady } from "@/lib/utils/clientReady";
import { normalizeHealthForm, validateHealthForm } from "@/lib/utils/validation";
import { CameraHealthAssist } from "./CameraHealthAssist";
import { LabUpload } from "./LabUpload";
import { OCRVerificationCard } from "./OCRVerificationCard";
import { ResultScreen } from "./ResultScreen";
import { RiskCheckWizard } from "./RiskCheckWizard";
import { SafetyDisclaimer } from "./SafetyDisclaimer";
import { UnoOneHealthView } from "./unone-health/UnoOneHealthView";

interface HomeDashboardProps {
  language: Language;
  online: boolean;
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  onLanguageChange: (language: Language) => void;
}

const storageKey = "swasthya-score-form";

const moduleCards = [
  {
    icon: HeartPulse,
    titleKey: "card.start.title",
    descriptionKey: "card.start.description",
    tab: "risk",
  },
  {
    icon: Camera,
    titleKey: "card.camera.title",
    descriptionKey: "card.camera.description",
    tab: "camera",
  },
  {
    icon: FileText,
    titleKey: "card.upload.title",
    descriptionKey: "card.upload.description",
    tab: "lab",
  },
  {
    icon: MessageCircleHeart,
    titleKey: "card.referral.title",
    descriptionKey: "card.referral.description",
    tab: "report",
  },
] as const;

const aiShowcaseCards = [
  {
    icon: FileText,
    titleKey: "unone.section.lab",
    descriptionKey: "unone.showcase.lab",
  },
  {
    icon: HeartPulse,
    titleKey: "unone.section.scan",
    descriptionKey: "unone.showcase.scan",
  },
  {
    icon: MessageCircleHeart,
    titleKey: "unone.section.symptoms",
    descriptionKey: "unone.showcase.symptoms",
  },
  {
    icon: BrainCircuit,
    titleKey: "unone.section.advisory",
    descriptionKey: "unone.showcase.advisory",
  },
] as const;

const kpiCards = [
  { key: "home.kpi.fast", icon: Activity },
  { key: "home.kpi.safe", icon: ShieldCheck },
  { key: "home.kpi.offline", icon: FileText },
] as const;

const productScreens = [
  {
    src: "/product-media/screenshots/02-home-dashboard.png",
    titleKey: "media.screen.dashboard.title",
    captionKey: "media.screen.dashboard.caption",
  },
  {
    src: "/product-media/screenshots/07-results-summary.png",
    titleKey: "media.screen.results.title",
    captionKey: "media.screen.results.caption",
  },
  {
    src: "/product-media/screenshots/10-lab-ocr-after-upload.png",
    titleKey: "media.screen.ocr.title",
    captionKey: "media.screen.ocr.caption",
  },
] as const;

function firstErrorStep(
  errors: Partial<Record<keyof HealthFormData, TranslationKey>>,
) {
  if (errors.age || errors.gender) return 0;
  if (errors.heightCm || errors.weightKg || errors.waistCm) return 1;
  if (errors.physicalActivity || errors.familyHistory) return 2;
  return 3;
}

function getInitialFormData(): HealthFormData {
  if (typeof window === "undefined") {
    return EMPTY_HEALTH_FORM;
  }

  const saved = window.localStorage.getItem(storageKey);
  if (!saved) {
    return EMPTY_HEALTH_FORM;
  }

  try {
    return JSON.parse(saved) as HealthFormData;
  } catch {
    window.localStorage.removeItem(storageKey);
    return EMPTY_HEALTH_FORM;
  }
}

function AppStatusChip({
  language,
  online,
}: {
  language: Language;
  online: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-xs font-bold text-white">
        <ShieldCheck className="h-4 w-4" />
        {translate(language, "app.safety")}
      </span>
      <span className="rounded-full bg-white/15 px-4 py-2 text-xs font-bold text-white">
        {translate(language, online ? "common.online" : "common.offline")}
      </span>
    </div>
  );
}

function ProductMediaShowcase({ language }: { language: Language }) {
  return (
    <section className="overflow-hidden rounded-[36px] border border-white/70 bg-white/95 p-5 shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--brand-700)]">
            {translate(language, "media.kicker")}
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--slate-950)]">
            {translate(language, "media.title")}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--slate-600)]">
            {translate(language, "media.description")}
          </p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-800">
          <PlayCircle className="h-4 w-4" />
          {translate(language, "media.videoBadge")}
        </span>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="mx-auto w-full max-w-[390px] rounded-[30px] bg-[linear-gradient(135deg,#ecfeff,#eff6ff)] p-3 shadow-inner lg:max-w-none">
          <video
            className="aspect-[9/16] max-h-[720px] w-full rounded-[24px] bg-slate-950 object-contain shadow-[0_24px_70px_rgba(15,23,42,0.18)]"
            controls
            muted
            playsInline
            preload="metadata"
            poster="/product-media/swasthyascore-landing-video-poster.png"
          >
            <source src="/product-media/swasthyascore-landing-video.mp4" type="video/mp4" />
            {translate(language, "media.videoFallback")}
          </video>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
          {productScreens.map((screen) => (
            <article
              key={screen.src}
              className="grid grid-cols-[96px_1fr] gap-3 rounded-[26px] border border-[var(--border-soft)] bg-white p-3 shadow-sm sm:grid-cols-1 lg:grid-cols-[96px_1fr]"
            >
              <Image
                src={screen.src}
                alt={translate(language, screen.titleKey)}
                width={192}
                height={384}
                className="h-36 w-24 rounded-[20px] object-cover object-top shadow-sm sm:h-48 sm:w-full lg:h-36 lg:w-24"
                loading="lazy"
              />
              <div className="min-w-0 self-center">
                <h3 className="text-sm font-bold text-[var(--slate-950)]">
                  {translate(language, screen.titleKey)}
                </h3>
                <p className="mt-2 text-xs leading-5 text-[var(--slate-600)]">
                  {translate(language, screen.captionKey)}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function HomeView({
  language,
  online,
  onTabChange,
  onLanguageChange,
  onMeasureHeartRate,
}: {
  language: Language;
  online: boolean;
  onTabChange: (tab: AppTab) => void;
  onLanguageChange: (language: Language) => void;
  onMeasureHeartRate: () => void;
}) {
  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-[40px] border border-white/60 bg-[linear-gradient(140deg,#064e3b_0%,#0f766e_42%,#0369a1_100%)] p-5 text-white shadow-[0_32px_90px_rgba(15,23,42,0.22)] sm:p-7">
        <div className="absolute -right-16 -top-16 h-52 w-52 rounded-full bg-white/15 blur-2xl" />
        <div className="absolute -bottom-20 left-8 h-56 w-56 rounded-full bg-emerald-300/20 blur-3xl" />
        <div className="relative">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-white/90">
                {translate(language, "app.mobileBadge")}
              </p>
              <h1 className="mt-4 max-w-2xl font-display text-4xl font-semibold tracking-tight sm:text-5xl">
                {translate(language, "home.hero.title")}
              </h1>
              <p className="mt-4 max-w-xl text-base leading-7 text-white/85">
                {translate(language, "home.hero.description")}
              </p>
            </div>
            <AppStatusChip language={language} online={online} />
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => onTabChange("risk")}
              className="min-h-14 rounded-full bg-white px-6 text-base font-bold text-emerald-950 shadow-sm"
            >
              {translate(language, "home.hero.cta")}
            </button>
            <button
              type="button"
              onClick={() => onTabChange("camera")}
              className="min-h-14 rounded-full bg-white/12 px-6 text-base font-bold text-white ring-1 ring-white/30"
            >
              {translate(language, "card.camera.title")}
            </button>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {kpiCards.map(({ key, icon: Icon }) => (
              <div
                key={key}
                className="rounded-[24px] bg-white/12 p-4 ring-1 ring-white/15"
              >
                <Icon className="h-5 w-5" />
                <p className="mt-3 text-sm font-semibold leading-6 text-white/90">
                  {translate(language, key)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--brand-700)]">
              {translate(language, "home.modules")}
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--slate-950)]">
              {translate(language, "home.modulesTitle")}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => onLanguageChange(language === "hi" ? "en" : "hi")}
            className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-3 text-xs font-bold text-[var(--brand-700)] shadow-sm"
          >
            <Languages className="h-4 w-4" />
            {translate(language, "card.hindi.title")}
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {moduleCards.map(({ icon: Icon, titleKey, descriptionKey, tab }) => (
            <button
              key={titleKey}
              type="button"
              onClick={() => onTabChange(tab)}
              className="group rounded-[30px] border border-white/70 bg-white/95 p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <span className="inline-flex rounded-2xl bg-[var(--surface-muted)] p-3 text-[var(--brand-700)]">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-lg font-semibold text-[var(--slate-950)]">
                {translate(language, titleKey)}
              </h3>
              <p className="mt-2 text-sm leading-6 text-[var(--slate-600)]">
                {translate(language, descriptionKey)}
              </p>
            </button>
          ))}
        </div>
      </section>

      <section className="overflow-hidden rounded-[36px] border border-white/70 bg-[linear-gradient(135deg,#064e3b_0%,#0f766e_45%,#0369a1_100%)] p-5 text-white shadow-[0_24px_70px_rgba(15,23,42,0.16)] sm:p-7">
        <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr] lg:items-center">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-white/90">
              <BrainCircuit className="h-4 w-4" />
              {translate(language, "unone.kicker")}
            </p>
            <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              {translate(language, "unone.title")}
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-white/85">
              {translate(language, "unone.showcase.subtitle")}
            </p>
            <p className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-white/10 px-3 py-2 text-xs leading-5 text-white/80 ring-1 ring-white/15">
              <ShieldCheck className="h-4 w-4 shrink-0" />
              {translate(language, "unone.privacy")}
            </p>
            <div className="mt-5">
              <button
                type="button"
                onClick={() => onTabChange("ai")}
                className="min-h-12 rounded-full bg-white px-6 text-sm font-bold text-emerald-950 shadow-sm"
              >
                {translate(language, "unone.showcase.cta")}
              </button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {aiShowcaseCards.map(({ icon: Icon, titleKey, descriptionKey }) => (
              <div
                key={titleKey}
                className="rounded-[24px] bg-white/10 p-4 ring-1 ring-white/15 backdrop-blur-sm"
              >
                <span className="inline-flex rounded-2xl bg-white/15 p-2.5 text-white">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-3 text-sm font-bold text-white">
                  {translate(language, titleKey)}
                </h3>
                <p className="mt-1.5 text-xs leading-5 text-white/80">
                  {translate(language, descriptionKey)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-[36px] border border-white/70 bg-[linear-gradient(135deg,#7f1d1d_0%,#be123c_45%,#0f766e_100%)] p-5 text-white shadow-[0_24px_70px_rgba(15,23,42,0.16)] sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-2xl">
            <h2 className="inline-flex items-center gap-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              <HeartPulse className="h-7 w-7" />
              {translate(language, "unone.heart.headline")}
            </h2>
            <p className="mt-3 text-sm leading-6 text-white/85">
              {translate(language, "unone.heart.body")}
            </p>
          </div>
          <button
            type="button"
            onClick={onMeasureHeartRate}
            className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-white px-6 text-sm font-bold text-rose-800 shadow-sm"
          >
            <HeartPulse className="h-4 w-4" />
            {translate(language, "unone.heart.cta")}
          </button>
        </div>
      </section>

      <ProductMediaShowcase language={language} />

      <div className="grid gap-4 lg:grid-cols-2">
        <p className="rounded-[28px] border border-white/70 bg-white/90 p-5 text-sm leading-6 text-[var(--slate-700)] shadow-sm">
          {translate(language, "app.privacy")}
        </p>
        <p className="rounded-[28px] border border-white/70 bg-white/90 p-5 text-sm leading-6 text-[var(--slate-700)] shadow-sm">
          {translate(language, "app.offlineReady")}
        </p>
      </div>
    </div>
  );
}

export function HomeDashboard({
  language,
  online,
  activeTab,
  onTabChange,
  onLanguageChange,
}: HomeDashboardProps) {
  const clientReady = useClientReady();
  const [healthInitialSection, setHealthInitialSection] = useState<
    "lab" | "scan" | "symptoms" | "advisory" | "timeline"
  >("lab");
  const [healthMountKey, setHealthMountKey] = useState(0);
  const [formData, setFormData] = useState<HealthFormData>(EMPTY_HEALTH_FORM);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof HealthFormData, TranslationKey>>
  >({});
  const [result, setResult] = useState<ScreeningResult | null>(null);
  const [inputSnapshot, setInputSnapshot] = useState<NormalizedHealthInput | null>(
    null,
  );
  const [aiExplanation, setAiExplanation] = useState<AiExplanationResult | null>(
    null,
  );
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    if (!clientReady) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setFormData(getInitialFormData());
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [clientReady]);

  useEffect(() => {
    if (!clientReady) {
      return;
    }

    window.localStorage.setItem(storageKey, JSON.stringify(formData));
  }, [clientReady, formData]);

  const updateField: HealthFormChangeHandler = (field, value) => {
    setFormData((current) => ({
      ...current,
      [field]: value,
    }));
    setFieldErrors((current) => ({
      ...current,
      [field]: undefined,
    }));
  };

  function toggleSymptom(symptom: Symptom) {
    setFormData((current) => {
      const currentSymptoms = current.symptoms;
      let nextSymptoms = currentSymptoms.includes(symptom)
        ? currentSymptoms.filter((item) => item !== symptom)
        : [...currentSymptoms.filter((item) => item !== "none"), symptom];

      if (symptom === "none") {
        nextSymptoms = ["none"];
      } else if (nextSymptoms.length === 0) {
        nextSymptoms = ["none"];
      }

      return {
        ...current,
        symptoms: nextSymptoms,
      };
    });
  }

  function handleReset() {
    setFormData(EMPTY_HEALTH_FORM);
    setFieldErrors({});
    setResult(null);
    setInputSnapshot(null);
    setAiExplanation(null);
    setAiError(null);
    window.localStorage.removeItem(storageKey);
  }

  /** Deep-link from the landing "Measure heart rate" CTA straight into the scan. */
  function openHeartRateScan() {
    setHealthInitialSection("scan");
    setHealthMountKey((k) => k + 1);
    onTabChange("ai");
  }

  function handleCalculate() {
    const validation = validateHealthForm(formData);

    if (!validation.isValid) {
      setFieldErrors(validation.fieldErrors);
      return firstErrorStep(validation.fieldErrors);
    }

    const normalized = normalizeHealthForm(formData);
    const calculated = calculateScreeningResult(normalized);

    startTransition(() => {
      setFieldErrors({});
      setInputSnapshot(normalized);
      setResult(calculated);
      setAiExplanation(null);
      setAiError(null);
    });

    return null;
  }

  function applyOcrValues(values: Partial<Record<
    "hba1c" | "fastingGlucose" | "randomGlucose" | "systolicBp" | "diastolicBp",
    string
  >>) {
    setFormData((current) => ({
      ...current,
      ...values,
    }));
  }

  async function handleGenerateExplanation() {
    if (!result || !inputSnapshot) {
      return;
    }

    if (!online) {
      setAiError(translate(language, "ai.explainOffline"));
      return;
    }

    setAiLoading(true);
    setAiError(null);

    try {
      const response = await fetch("/api/ai/explain", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          language,
          patientValues: inputSnapshot,
          screeningResult: result,
        }),
      });

      const payload = (await response.json()) as AiExplanationResult & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? translate(language, "ai.explainFailure"));
      }

      setAiExplanation(payload);
    } catch (caughtError) {
      setAiError(
        caughtError instanceof Error
          ? caughtError.message
          : translate(language, "ai.explainFailure"),
      );
    } finally {
      setAiLoading(false);
    }
  }

  const reportContent =
    result && inputSnapshot
      ? buildReportText({
          language,
          formData: inputSnapshot,
          result,
          aiExplanation,
          referralNote:
            aiExplanation?.doctorReferralNote ??
            buildDeterministicReferralNote(language, inputSnapshot, result),
        })
      : null;

  return (
    <main
      id="top"
      className="mx-auto flex w-full max-w-6xl scroll-mb-40 flex-col gap-5 px-4 pb-[calc(9rem+env(safe-area-inset-bottom))] pt-4 sm:px-6 lg:px-8"
    >
      {activeTab === "home" ? (
        <HomeView
          language={language}
          online={online}
          onTabChange={onTabChange}
          onLanguageChange={onLanguageChange}
          onMeasureHeartRate={openHeartRateScan}
        />
      ) : null}

      {activeTab === "risk" ? (
        <RiskCheckWizard
          language={language}
          online={online}
          formData={formData}
          fieldErrors={fieldErrors}
          inputSnapshot={inputSnapshot}
          result={result}
          aiExplanation={aiExplanation}
          aiError={aiError}
          aiLoading={aiLoading}
          reportContent={reportContent}
          onChange={updateField}
          onSymptomToggle={toggleSymptom}
          onCalculate={handleCalculate}
          onReset={handleReset}
          onGenerateExplanation={handleGenerateExplanation}
          onOpenCamera={() => onTabChange("camera")}
          onOpenLab={() => onTabChange("lab")}
        />
      ) : null}

      {activeTab === "camera" ? (
        <CameraHealthAssist
          language={language}
          online={online}
          onApplyField={updateField}
        />
      ) : null}

      {activeTab === "lab" ? (
        <div className="space-y-5">
          <section className="rounded-[34px] border border-white/70 bg-[linear-gradient(135deg,#eff6ff,#f0fdfa)] p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--brand-700)]">
              {translate(language, "lab.tabTitle")}
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--slate-950)]">
              {translate(language, "ai.ocrTitle")}
            </h1>
            <p className="mt-2 text-sm leading-6 text-[var(--slate-600)]">
              {translate(language, "lab.tabSubtitle")}
            </p>
          </section>
          <LabUpload language={language} online={online} onApplyValues={applyOcrValues} />
          <OCRVerificationCard
            language={language}
            formData={formData}
            fieldErrors={fieldErrors}
            onChange={updateField}
            onOpenRisk={() => onTabChange("risk")}
          />
        </div>
      ) : null}

      {activeTab === "report" ? (
        <div className="space-y-5">
          <section className="rounded-[34px] border border-white/70 bg-[linear-gradient(135deg,#fefce8,#eff6ff)] p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--brand-700)]">
              {translate(language, "report.tabTitle")}
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--slate-950)]">
              {translate(language, "report.title")}
            </h1>
            <p className="mt-2 text-sm leading-6 text-[var(--slate-600)]">
              {translate(language, "report.tabSubtitle")}
            </p>
          </section>
          <ResultScreen
            language={language}
            inputSnapshot={inputSnapshot}
            result={result}
            aiExplanation={aiExplanation}
            aiError={aiError}
            aiLoading={aiLoading}
            online={online}
            reportContent={reportContent}
            onGenerateExplanation={handleGenerateExplanation}
          />
          {!result ? (
            <button
              type="button"
              onClick={() => onTabChange("risk")}
              className="min-h-12 w-full rounded-full bg-[var(--brand-700)] px-5 text-sm font-bold text-white shadow-sm"
            >
              {translate(language, "report.startRisk")}
            </button>
          ) : null}
          <SafetyDisclaimer language={language} />
        </div>
      ) : null}

      {activeTab === "ai" ? (
        <UnoOneHealthView
          key={healthMountKey}
          language={language}
          online={online}
          initialSection={healthInitialSection}
        />
      ) : null}
    </main>
  );
}
