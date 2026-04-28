import { en } from "./en";
import { hi } from "./hi";

export type Language = "en" | "hi";
export type TranslationKey = keyof typeof en;
export type TranslationSchema = Record<TranslationKey, string>;

const dictionaries: Record<Language, TranslationSchema> = {
  en,
  hi,
};

export function getDictionary(language: Language): TranslationSchema {
  return dictionaries[language];
}

export function translate(
  language: Language,
  key: TranslationKey,
  replacements?: Record<string, string | number>,
): string {
  const value = dictionaries[language][key] ?? key;
  if (!replacements) {
    return value;
  }

  return Object.entries(replacements).reduce(
    (message, [token, replacement]) =>
      message.replaceAll(`{${token}}`, String(replacement)),
    value,
  );
}
