"use client";

import type { Language } from "@/lib/i18n";
import { translate } from "@/lib/i18n";

interface LanguageToggleProps {
  language: Language;
  onChange: (language: Language) => void;
}

export function LanguageToggle({
  language,
  onChange,
}: LanguageToggleProps) {
  return (
    <div
      className="inline-flex rounded-full border border-white/50 bg-white/80 p-1 shadow-sm backdrop-blur"
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
            className={`min-w-24 rounded-full px-4 py-2 text-sm font-semibold transition ${
              active
                ? "bg-[var(--brand-700)] text-white shadow-sm"
                : "text-[var(--slate-700)] hover:bg-[var(--surface-muted)]"
            }`}
            role="tab"
            aria-selected={active}
          >
            {translate(language, value === "en" ? "common.english" : "common.hindi")}
          </button>
        );
      })}
    </div>
  );
}
