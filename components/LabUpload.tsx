"use client";

import { LoaderCircle, UploadCloud } from "lucide-react";
import { useState } from "react";
import type { Language } from "@/lib/i18n";
import { translate } from "@/lib/i18n";
import type { LabOcrResult } from "@/lib/types/health";

interface LabUploadProps {
  language: Language;
  online: boolean;
  onApplyValues: (values: Partial<Record<"hba1c" | "fastingGlucose" | "randomGlucose" | "systolicBp" | "diastolicBp", string>>) => void;
}

export function LabUpload({
  language,
  online,
  onApplyValues,
}: LabUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<LabOcrResult | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleExtract() {
    if (!file) {
      setError(translate(language, "upload.noFile"));
      return;
    }

    if (!online) {
      setError(translate(language, "ai.ocrOffline"));
      return;
    }

    setLoading(true);
    setError(null);
    setStatus(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/ai/ocr-lab", {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json()) as LabOcrResult & { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? translate(language, "ai.ocrFailure"));
      }

      setResult(payload);
      setStatus(translate(language, "ai.ocrSuccess"));
      onApplyValues({
        hba1c: payload.hba1c == null ? "" : String(payload.hba1c),
        fastingGlucose:
          payload.fastingGlucose == null ? "" : String(payload.fastingGlucose),
        randomGlucose:
          payload.randomGlucose == null ? "" : String(payload.randomGlucose),
        systolicBp: payload.systolicBp == null ? "" : String(payload.systolicBp),
        diastolicBp:
          payload.diastolicBp == null ? "" : String(payload.diastolicBp),
      });
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : translate(language, "ai.ocrFailure"),
      );
    } finally {
      setLoading(false);
    }
  }

  function confidenceLabel(value: LabOcrResult["confidence"]) {
    if (value === "high") return translate(language, "ai.ocrConfidenceHigh");
    if (value === "medium") return translate(language, "ai.ocrConfidenceMedium");
    return translate(language, "ai.ocrConfidenceLow");
  }

  return (
    <section
      id="lab-upload"
      className="rounded-[28px] border border-[var(--border-soft)] bg-white/95 p-5 shadow-sm"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--brand-700)]">
            {translate(language, "section.step3")}
          </p>
          <h3 className="mt-1 text-xl font-semibold text-[var(--slate-950)]">
            {translate(language, "ai.ocrTitle")}
          </h3>
          <p className="mt-2 text-sm leading-6 text-[var(--slate-600)]">
            {translate(language, "ai.ocrDescription")}
          </p>
        </div>
        <div className="rounded-2xl bg-[var(--surface-muted)] p-3 text-[var(--brand-700)]">
          <UploadCloud className="h-5 w-5" />
        </div>
      </div>

      <div className="mt-5 rounded-[24px] border border-dashed border-[var(--border-soft)] bg-[var(--surface-muted)] p-4">
        <label className="flex cursor-pointer flex-col gap-2 text-sm text-[var(--slate-700)]">
          <span className="font-semibold">{translate(language, "upload.select")}</span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              const selectedFile = event.target.files?.[0] ?? null;
              setFile(selectedFile);
              setResult(null);
              setError(null);
              setStatus(null);
            }}
          />
          <span>{file?.name ?? translate(language, "upload.noFile")}</span>
          <span className="text-xs text-[var(--slate-500)]">
            {translate(language, "upload.fileHint")}
          </span>
        </label>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={handleExtract}
          disabled={loading || !file}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--brand-700)] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--brand-800)] disabled:cursor-not-allowed disabled:bg-[var(--slate-400)]"
        >
          {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
          {translate(language, loading ? "ai.ocrLoading" : "ai.ocrButton")}
        </button>
        <p className="text-xs leading-5 text-[var(--slate-500)]">
          {translate(language, "ai.ocrConsent")}
        </p>
      </div>

      {status ? (
        <p className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {status}
        </p>
      ) : null}
      {error ? (
        <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      {result ? (
        <div className="mt-4 space-y-3">
          <p className="rounded-2xl bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--slate-700)]">
            {translate(language, "upload.valuesEditable")}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--slate-700)]">
              {translate(language, "upload.confidence")}: {confidenceLabel(result.confidence)}
            </div>
            <div className="rounded-2xl bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--slate-700)]">
              {translate(language, "upload.preview")}: {translate(language, "form.hba1c")} {result.hba1c ?? "-"} | {translate(language, "form.fasting")} {result.fastingGlucose ?? "-"} | {translate(language, "form.random")} {result.randomGlucose ?? "-"}
            </div>
          </div>
          {result.warnings.length > 0 ? (
            <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <p className="font-semibold">{translate(language, "ai.ocrWarnings")}</p>
              <ul className="mt-2 space-y-1">
                {result.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
