"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import type { Language, TranslationKey } from "@/lib/i18n";
import { translate } from "@/lib/i18n";
import type { SymptomEvent } from "@/lib/unone-health";
import { getSwasthyakAdapter } from "@/modules/unone-health/adapters/swasthyak-adapter/SwasthyakAdapter";

interface SymptomsInputProps {
  language: Language;
  online: boolean;
  patientId: string;
  onSymptoms: (event: SymptomEvent) => void;
}

export function SymptomsInput({
  language,
  online,
  patientId,
  onSymptoms,
}: SymptomsInputProps) {
  const [text, setText] = useState("");
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SymptomEvent | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    if (!consent) {
      setError(translate(language, "unone.consentRequired"));
      return;
    }
    if (!text.trim()) return;
    setLoading(true);
    try {
      const { event } = await getSwasthyakAdapter().collectSymptoms({
        patientId,
        text,
        source: "text",
      });
      setResult(event);
      onSymptoms(event);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-4 rounded-[30px] border border-white/70 bg-white/95 p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-[var(--slate-950)]">
        {translate(language, "unone.section.symptoms")}
      </h2>

      <label className="flex items-start gap-3 rounded-[22px] bg-[var(--surface-muted)] p-4 text-sm text-[var(--slate-800)]">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
        />
        <span>{translate(language, "unone.consentVoice")}</span>
      </label>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={translate(language, "unone.symptoms.placeholder")}
        className="min-h-32 w-full rounded-[22px] border border-[var(--border-soft)] bg-white p-4 text-sm text-[var(--slate-900)] outline-none focus:border-[var(--brand-700)]"
      />

      <button
        type="button"
        disabled={loading || !online}
        onClick={handleSubmit}
        className="rounded-full bg-[var(--brand-700)] px-5 py-3 text-sm font-bold text-white shadow-sm disabled:opacity-50"
      >
        {translate(language, "unone.symptoms.submit")}
      </button>

      {error ? (
        <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
      ) : null}

      {result ? (
        <div className="space-y-3">
          {result.red_flags.length > 0 ? (
            <div className="rounded-2xl bg-red-50 p-4">
              <p className="inline-flex items-center gap-2 text-sm font-bold text-red-800">
                <AlertTriangle className="h-4 w-4" />
                {translate(language, "unone.symptoms.emergency")}
              </p>
              <ul className="mt-2 list-disc pl-5 text-sm text-red-700">
                {result.red_flags.map((flag, index) => (
                  <li key={`${index}-${flag}`}>{flag}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <p className="rounded-2xl bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--slate-800)]">
            <strong>{translate(language, "unone.symptoms.severity")}: </strong>
            {translate(language, `unone.severity.${result.severity}` as TranslationKey)}
          </p>
          <p className="text-sm text-[var(--slate-700)]">{result.summary}</p>
        </div>
      ) : null}
    </section>
  );
}