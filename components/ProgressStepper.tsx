import type { Language } from "@/lib/i18n";
import { translate } from "@/lib/i18n";

interface ProgressStepperProps {
  language: Language;
  currentStep: number;
  steps: string[];
}

export function ProgressStepper({
  language,
  currentStep,
  steps,
}: ProgressStepperProps) {
  const progress = ((currentStep + 1) / steps.length) * 100;

  return (
    <div className="rounded-[28px] border border-white/70 bg-white/90 p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--brand-700)]">
          {translate(language, "wizard.stepCounter", {
            current: currentStep + 1,
            total: steps.length,
          })}
        </p>
        <p className="text-sm font-semibold text-[var(--slate-800)]">
          {steps[currentStep]}
        </p>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--surface-muted)]">
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,#10b981,#0891b2)] transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="mt-4 grid grid-cols-5 gap-2">
        {steps.map((step, index) => (
          <div
            key={step}
            className={`h-2 rounded-full transition ${
              index <= currentStep ? "bg-[var(--brand-700)]" : "bg-slate-200"
            }`}
            aria-label={step}
          />
        ))}
      </div>
    </div>
  );
}
