import type { Language } from "@/lib/i18n";
import { translate } from "@/lib/i18n";

interface SafetyDisclaimerProps {
  language: Language;
}

const disclaimerKeys = [
  "disclaimer.screeningOnly",
  "disclaimer.bpRepeat",
  "disclaimer.bmiScreening",
  "disclaimer.privacy",
  "disclaimer.offlineAi",
  "disclaimer.notDiagnosis",
] as const;

export function SafetyDisclaimer({ language }: SafetyDisclaimerProps) {
  return (
    <section
      id="advice"
      className="rounded-[28px] border border-[var(--border-soft)] bg-white/95 p-5 shadow-sm"
    >
      <h3 className="text-lg font-semibold text-[var(--slate-950)]">
        {translate(language, "section.disclaimer")}
      </h3>
      <div className="mt-4 space-y-3">
        {disclaimerKeys.map((key) => (
          <p
            key={key}
            className="rounded-2xl bg-[var(--surface-muted)] px-4 py-3 text-sm leading-6 text-[var(--slate-700)]"
          >
            {translate(language, key)}
          </p>
        ))}
      </div>
    </section>
  );
}
