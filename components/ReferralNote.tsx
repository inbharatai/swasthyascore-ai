import type { Language } from "@/lib/i18n";
import { translate } from "@/lib/i18n";

interface ReferralNoteProps {
  language: Language;
  note: string;
  isAiEnhanced: boolean;
}

export function ReferralNote({
  language,
  note,
  isAiEnhanced,
}: ReferralNoteProps) {
  return (
    <section className="rounded-[28px] border border-[var(--border-soft)] bg-white/95 p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-[var(--slate-950)]">
          {translate(language, "result.referralTitle")}
        </h3>
        <span className="rounded-full bg-[var(--surface-muted)] px-3 py-1 text-xs font-semibold text-[var(--slate-700)]">
          {isAiEnhanced
            ? translate(language, "common.ai")
            : translate(language, "result.manualOnly")}
        </span>
      </div>
      <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-[var(--slate-800)]">
        {note}
      </p>
    </section>
  );
}
