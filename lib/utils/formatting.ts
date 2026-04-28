import type { Language } from "@/lib/i18n";

const localeByLanguage: Record<Language, string> = {
  en: "en-IN",
  hi: "hi-IN",
};

export function formatDecimal(
  value: number | null | undefined,
  language: Language,
  maximumFractionDigits = 1,
): string {
  if (value == null || Number.isNaN(value)) {
    return "-";
  }

  return new Intl.NumberFormat(localeByLanguage[language], {
    maximumFractionDigits,
    minimumFractionDigits: 0,
  }).format(value);
}

export function formatDateTime(date: Date, language: Language): string {
  return new Intl.DateTimeFormat(localeByLanguage[language], {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function joinLines(lines: string[]): string {
  return lines.filter(Boolean).join("\n");
}

export function toSentenceList(values: string[]): string {
  return values.filter(Boolean).join(" ");
}
