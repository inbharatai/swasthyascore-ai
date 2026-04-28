"use client";

import { Eye, LoaderCircle, UploadCloud } from "lucide-react";
import { useState } from "react";
import type { AiVisibleConcernResult } from "@/lib/types/camera";
import type { Language } from "@/lib/i18n";
import { translate } from "@/lib/i18n";

interface VisibleRiskAssistProps {
  language: Language;
  online: boolean;
}

export function VisibleRiskAssist({ language, online }: VisibleRiskAssistProps) {
  const [file, setFile] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [result, setResult] = useState<AiVisibleConcernResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleAnalyze() {
    if (!file) {
      setError(translate(language, "camera.noImage"));
      return;
    }

    if (!consent) {
      setError(translate(language, "camera.visibleConsentRequired"));
      return;
    }

    if (!online) {
      setError(translate(language, "camera.visibleOffline"));
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("language", language);

    try {
      const response = await fetch("/api/ai/visible-concern", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as AiVisibleConcernResult & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? translate(language, "camera.visibleFailure"));
      }

      setResult(payload);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : translate(language, "camera.visibleFailure"),
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-[30px] border border-white/70 bg-white/95 p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="rounded-2xl bg-rose-50 p-3 text-rose-700">
          <Eye className="h-5 w-5" />
        </span>
        <div>
          <h3 className="text-lg font-semibold text-[var(--slate-950)]">
            {translate(language, "camera.visible.title")}
          </h3>
          <p className="mt-1 text-sm leading-6 text-[var(--slate-600)]">
            {translate(language, "camera.visible.description")}
          </p>
        </div>
      </div>

      <label className="mt-5 flex cursor-pointer flex-col gap-2 rounded-[24px] border border-dashed border-[var(--border-soft)] bg-[var(--surface-muted)] p-4 text-sm text-[var(--slate-700)]">
        <span className="inline-flex items-center gap-2 font-bold">
          <UploadCloud className="h-4 w-4" />
          {translate(language, "camera.uploadVisible")}
        </span>
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            setFile(event.target.files?.[0] ?? null);
            setResult(null);
            setError(null);
          }}
        />
        <span>{file?.name ?? translate(language, "upload.noFile")}</span>
      </label>

      <label className="mt-4 flex gap-3 rounded-[24px] bg-sky-50 p-4 text-sm leading-6 text-sky-900">
        <input
          type="checkbox"
          checked={consent}
          onChange={(event) => setConsent(event.target.checked)}
          className="mt-1 h-4 w-4"
        />
        <span>{translate(language, "camera.visibleConsent")}</span>
      </label>

      <button
        type="button"
        onClick={handleAnalyze}
        disabled={loading || !file}
        className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--brand-700)] px-5 text-sm font-bold text-white shadow-sm disabled:cursor-not-allowed disabled:bg-[var(--slate-400)]"
      >
        {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
        {translate(language, loading ? "camera.visibleLoading" : "camera.visibleButton")}
      </button>

      {error ? (
        <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      {result ? (
        <div className="mt-4 space-y-3 rounded-[24px] bg-[var(--surface-muted)] p-4">
          <p className="text-sm font-bold text-[var(--slate-950)]">
            {translate(language, "camera.visibleSummary")}
          </p>
          <p className="text-sm leading-6 text-[var(--slate-700)]">
            {result.summary}
          </p>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--brand-700)]">
            {translate(language, "camera.visibleConcerns")}
          </p>
          <ul className="space-y-2 text-sm leading-6 text-[var(--slate-700)]">
            {result.visibleConcerns.map((concern) => (
              <li key={concern}>{concern}</li>
            ))}
          </ul>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--brand-700)]">
            {translate(language, "camera.recommendedAction")}
          </p>
          <ul className="space-y-2 text-sm leading-6 text-[var(--slate-700)]">
            {result.recommendedAction.map((action) => (
              <li key={action}>{action}</li>
            ))}
          </ul>
          <p className="rounded-2xl bg-white px-4 py-3 text-xs leading-5 text-[var(--slate-600)]">
            {result.safetyDisclaimer || translate(language, "camera.notDiagnosis")}
          </p>
        </div>
      ) : null}
    </section>
  );
}
