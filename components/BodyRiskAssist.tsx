"use client";

import { Activity, WandSparkles } from "lucide-react";
import { useState, type RefObject } from "react";
import { estimateBodyRiskFromLandmarks } from "@/lib/camera/bodyRiskEstimate";
import { analyzeVideoPose, landmarksToBodyRiskInput } from "@/lib/camera/poseLandmarks";
import type { BodyRiskEstimateResult, VisualBodyRiskCategory } from "@/lib/types/camera";
import type { Language, TranslationKey } from "@/lib/i18n";
import { translate } from "@/lib/i18n";

interface BodyRiskAssistProps {
  language: Language;
  videoRef: RefObject<HTMLVideoElement | null>;
}

const bodyRiskKeys: Record<VisualBodyRiskCategory, TranslationKey> = {
  possible_undernutrition_risk: "camera.body.undernutrition",
  possible_normal_body_size: "camera.body.normal",
  possible_overweight_risk: "camera.body.overweight",
  possible_central_obesity_risk: "camera.body.central",
  unclear_manual_needed: "camera.body.unclear",
};

export function BodyRiskAssist({ language, videoRef }: BodyRiskAssistProps) {
  const [result, setResult] = useState<BodyRiskEstimateResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAnalyze() {
    const video = videoRef.current;
    if (!video) {
      setError(translate(language, "camera.startFirst"));
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const analysis = await analyzeVideoPose(video);
      const input = landmarksToBodyRiskInput(
        analysis,
        video.videoWidth || video.clientWidth,
      );
      const estimate = estimateBodyRiskFromLandmarks(input);
      setResult({
        ...estimate,
        warnings: [...analysis.warnings, ...estimate.warnings],
      });
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : translate(language, "camera.poseFailed"),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-[30px] border border-white/70 bg-white/95 p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="rounded-2xl bg-amber-50 p-3 text-amber-700">
          <Activity className="h-5 w-5" />
        </span>
        <div>
          <h3 className="text-lg font-semibold text-[var(--slate-950)]">
            {translate(language, "camera.body.title")}
          </h3>
          <p className="mt-1 text-sm leading-6 text-[var(--slate-600)]">
            {translate(language, "camera.body.description")}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={handleAnalyze}
        disabled={busy}
        className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--brand-700)] px-5 text-sm font-bold text-white shadow-sm disabled:cursor-not-allowed disabled:bg-[var(--slate-400)]"
      >
        <WandSparkles className="h-4 w-4" />
        {translate(language, busy ? "common.loading" : "camera.analyzePose")}
      </button>

      {error ? (
        <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      {result ? (
        <div className="mt-4 rounded-[24px] bg-[var(--surface-muted)] p-4">
          <p className="text-sm font-bold text-[var(--slate-950)]">
            {translate(language, bodyRiskKeys[result.category])}
          </p>
          <p className="mt-2 text-xs leading-5 text-[var(--slate-600)]">
            {translate(language, "camera.confidence")}: {result.confidence}
          </p>
          <p className="mt-2 text-xs leading-5 text-[var(--slate-600)]">
            {translate(language, "camera.body.confirmManual")}
          </p>
          {result.warnings.length > 0 ? (
            <ul className="mt-3 space-y-2 text-xs leading-5 text-amber-800">
              {result.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
