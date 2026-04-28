"use client";

import type { Language } from "@/lib/i18n";
import { translate } from "@/lib/i18n";

interface LanguageToggleProps {
  language: Language;
  onChange: (language: Language) => void;
  compact?: boolean;
}

export function LanguageToggle({
  language,
  onChange,
  compact = false,
}: LanguageToggleProps) {
  return (
    <div
      className={`inline-flex rounded-full border border-white/50 bg-white/80 p-1 shadow-sm backdrop-blur ${
        compact ? "scale-95" : ""
      }`}
      role="tablist"
      aria-label="Language switcher"
    >
      {(["en", "hi"] as const).map((value) => {
        const active = value === language;
        return (
          <button
            key={value}
            type="button"
            onClick={() => onChange(value)}
            className={`${compact ? "min-w-11 px-3 py-2 text-xs" : "min-w-24 px-4 py-2 text-sm"} rounded-full font-semibold transition ${
              active
                ? "bg-[var(--brand-700)] text-white shadow-sm"
                : "text-[var(--slate-700)] hover:bg-[var(--surface-muted)]"
            }`}
            role="tab"
            aria-selected={active}
          >
            {compact
              ? translate(language, value === "en" ? "common.enShort" : "common.hiShort")
              : translate(language, value === "en" ? "common.english" : "common.hindi")}
          </button>
        );
      })}
    </div>
  );
}
