import type { Language } from "@/lib/i18n";
import { translate } from "@/lib/i18n";
import { ReferralNote } from "./ReferralNote";

interface ReferralNoteCardProps {
  language: Language;
  note: string;
  isAiEnhanced: boolean;
}

export function ReferralNoteCard({
  language,
  note,
  isAiEnhanced,
}: ReferralNoteCardProps) {
  return (
    <div className="space-y-3">
      <p className="rounded-[22px] bg-sky-50 px-4 py-3 text-xs leading-5 text-sky-800">
        {translate(language, "report.referralSafety")}
      </p>
      <ReferralNote
        language={language}
        note={note}
        isAiEnhanced={isAiEnhanced}
      />
    </div>
  );
}
