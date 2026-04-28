"use client";

import { useState } from "react";
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
import { BasicDetailsStep } from "./BasicDetailsStep";
import { LabValuesStep } from "./LabValuesStep";
import { MeasurementStep } from "./MeasurementStep";
import { ProgressStepper } from "./ProgressStepper";
import { ResultScreen } from "./ResultScreen";
import { SymptomsStep } from "./SymptomsStep";

interface RiskCheckWizardProps {
  language: Language;
  online: boolean;
  formData: HealthFormData;
  fieldErrors: Partial<Record<keyof HealthFormData, TranslationKey>>;
  inputSnapshot: NormalizedHealthInput | null;
  result: ScreeningResult | null;
  aiExplanation: AiExplanationResult | null;
  aiError: string | null;
  aiLoading: boolean;
  reportContent: string | null;
  onChange: HealthFormChangeHandler;
  onSymptomToggle: (symptom: Symptom) => void;
  onCalculate: () => number | null;
  onReset: () => void;
  onGenerateExplanation: () => void;
  onOpenCamera: () => void;
  onOpenLab: () => void;
}

export function RiskCheckWizard({
  language,
  online,
  formData,
  fieldErrors,
  inputSnapshot,
  result,
  aiExplanation,
  aiError,
  aiLoading,
  reportContent,
  onChange,
  onSymptomToggle,
  onCalculate,
  onReset,
  onGenerateExplanation,
  onOpenCamera,
  onOpenLab,
}: RiskCheckWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const steps = [
    translate(language, "wizard.basic"),
    translate(language, "wizard.measurements"),
    translate(language, "wizard.riskFactors"),
    translate(language, "wizard.labs"),
    translate(language, "wizard.results"),
  ];

  function handleNext() {
    if (currentStep < 3) {
      setCurrentStep((step) => step + 1);
      return;
    }

    if (currentStep === 3) {
      const invalidStep = onCalculate();
      setCurrentStep(invalidStep ?? 4);
    }
  }

  function handleReset() {
    onReset();
    setCurrentStep(0);
  }

  return (
    <section className="space-y-5">
      <div className="rounded-[34px] border border-white/70 bg-[linear-gradient(135deg,#f0fdfa,#eff6ff)] p-5 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--slate-950)]">
          {translate(language, "wizard.title")}
        </h1>
        <p className="mt-2 text-sm leading-6 text-[var(--slate-600)]">
          {translate(language, "wizard.subtitle")}
        </p>
      </div>

      <ProgressStepper language={language} currentStep={currentStep} steps={steps} />

      {Object.keys(fieldErrors).length > 0 ? (
        <p className="rounded-[24px] bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
          {translate(language, "validation.fixErrors")}
        </p>
      ) : null}

      {currentStep === 0 ? (
        <BasicDetailsStep
          language={language}
          formData={formData}
          fieldErrors={fieldErrors}
          onChange={onChange}
        />
      ) : null}
      {currentStep === 1 ? (
        <MeasurementStep
          language={language}
          formData={formData}
          fieldErrors={fieldErrors}
          onChange={onChange}
          onOpenCamera={onOpenCamera}
        />
      ) : null}
      {currentStep === 2 ? (
        <SymptomsStep
          language={language}
          formData={formData}
          fieldErrors={fieldErrors}
          onChange={onChange}
          onSymptomToggle={onSymptomToggle}
        />
      ) : null}
      {currentStep === 3 ? (
        <LabValuesStep
          language={language}
          formData={formData}
          fieldErrors={fieldErrors}
          onChange={onChange}
          onOpenLab={onOpenLab}
        />
      ) : null}
      {currentStep === 4 ? (
        <ResultScreen
          language={language}
          inputSnapshot={inputSnapshot}
          result={result}
          aiExplanation={aiExplanation}
          aiError={aiError}
          aiLoading={aiLoading}
          online={online}
          reportContent={reportContent}
          onGenerateExplanation={onGenerateExplanation}
        />
      ) : null}

      <div className="sticky bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-20 rounded-full border border-white/70 bg-white/90 p-2 shadow-[0_20px_60px_rgba(15,23,42,0.18)] backdrop-blur">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCurrentStep((step) => Math.max(0, step - 1))}
            disabled={currentStep === 0}
            className="min-h-12 flex-1 rounded-full border border-[var(--border-soft)] px-4 text-sm font-bold text-[var(--slate-700)] disabled:cursor-not-allowed disabled:opacity-45"
          >
            {translate(language, "wizard.back")}
          </button>
          {currentStep < 4 ? (
            <button
              type="button"
              onClick={handleNext}
              className="min-h-12 flex-[1.5] rounded-full bg-[var(--brand-700)] px-4 text-sm font-bold text-white shadow-sm"
            >
              {translate(
                language,
                currentStep === 3 ? "wizard.calculate" : "wizard.next",
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleReset}
              className="min-h-12 flex-[1.5] rounded-full bg-[var(--brand-700)] px-4 text-sm font-bold text-white shadow-sm"
            >
              {translate(language, "wizard.startAgain")}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
