"use client";

import { Ruler, WandSparkles } from "lucide-react";
import { useState, type RefObject } from "react";
import { estimateHeightWithReference } from "@/lib/camera/heightEstimate";
import { analyzeVideoPose, estimateBodyPixelHeight } from "@/lib/camera/poseLandmarks";
import type {
  HeightEstimateResult,
  ReferenceObjectType,
} from "@/lib/types/camera";
import type { Language } from "@/lib/i18n";
import { translate } from "@/lib/i18n";
import { SelectField, TextField } from "./ui/FormControls";

interface HeightAssistProps {
  language: Language;
  videoRef: RefObject<HTMLVideoElement | null>;
  onApplyHeight: (heightCm: string) => void;
}

const referenceDefaults: Record<ReferenceObjectType, number | null> = {
  none: null,
  a4_sheet: 29.7,
  qr_marker: 10,
  one_meter_strip: 100,
  known_object: null,
  manual_reference: null,
};

export function HeightAssist({
  language,
  videoRef,
  onApplyHeight,
}: HeightAssistProps) {
  const [referenceType, setReferenceType] =
    useState<ReferenceObjectType>("none");
  const [referenceHeight, setReferenceHeight] = useState("");
  const [referencePixels, setReferencePixels] = useState("");
  const [result, setResult] = useState<HeightEstimateResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleReferenceTypeChange(value: string) {
    const nextType = value as ReferenceObjectType;
    setReferenceType(nextType);
    const defaultHeight = referenceDefaults[nextType];
    setReferenceHeight(defaultHeight == null ? "" : String(defaultHeight));
  }

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
      const bodyPixelHeight = estimateBodyPixelHeight(
        analysis,
        video.videoHeight || video.clientHeight,
      );
      const estimate = estimateHeightWithReference({
        referenceType,
        referenceHeightCm: referenceHeight ? Number(referenceHeight) : null,
        referencePixelHeight: referencePixels ? Number(referencePixels) : null,
        bodyPixelHeight,
        poseConfidence: analysis.confidence,
      });
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
        <span className="rounded-2xl bg-emerald-50 p-3 text-emerald-700">
          <Ruler className="h-5 w-5" />
        </span>
        <div>
          <h3 className="text-lg font-semibold text-[var(--slate-950)]">
            {translate(language, "camera.height.title")}
          </h3>
          <p className="mt-1 text-sm leading-6 text-[var(--slate-600)]">
            {translate(language, "camera.height.description")}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4">
        <SelectField
          label={translate(language, "camera.referenceType")}
          value={referenceType}
          onChange={handleReferenceTypeChange}
          placeholder="--"
          options={[
            { value: "none", label: translate(language, "camera.reference.none") },
            { value: "a4_sheet", label: translate(language, "camera.reference.a4") },
            {
              value: "qr_marker",
              label: translate(language, "camera.reference.qr"),
            },
            {
              value: "one_meter_strip",
              label: translate(language, "camera.reference.strip"),
            },
            {
              value: "known_object",
              label: translate(language, "camera.reference.known"),
            },
            {
              value: "manual_reference",
              label: translate(language, "camera.reference.manual"),
            },
          ]}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label={translate(language, "camera.referenceHeight")}
            value={referenceHeight}
            onChange={setReferenceHeight}
            type="number"
            inputMode="decimal"
            unit={translate(language, "form.units.cm")}
          />
          <TextField
            label={translate(language, "camera.referencePixelHeight")}
            value={referencePixels}
            onChange={setReferencePixels}
            type="number"
            inputMode="decimal"
            unit="px"
          />
        </div>
        <button
          type="button"
          onClick={handleAnalyze}
          disabled={busy}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[var(--brand-700)] px-5 text-sm font-bold text-white shadow-sm disabled:cursor-not-allowed disabled:bg-[var(--slate-400)]"
        >
          <WandSparkles className="h-4 w-4" />
          {translate(language, busy ? "common.loading" : "camera.analyzePose")}
        </button>
      </div>

      {error ? (
        <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      {result ? (
        <div className="mt-4 rounded-[24px] bg-[var(--surface-muted)] p-4">
          <p className="text-sm font-bold text-[var(--slate-950)]">
            {result.estimatedHeightCm
              ? translate(language, "camera.estimatedHeight", {
                  height: result.estimatedHeightCm,
                })
              : translate(language, "camera.noReference")}
          </p>
          <p className="mt-2 text-xs leading-5 text-[var(--slate-600)]">
            {translate(language, "camera.confidence")}: {result.confidence}
          </p>
          <p className="mt-2 text-xs leading-5 text-[var(--slate-600)]">
            {translate(language, "camera.manualPreferred")}
          </p>
          {result.warnings.length > 0 ? (
            <ul className="mt-3 space-y-2 text-xs leading-5 text-amber-800">
              {result.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : null}
          {result.estimatedHeightCm ? (
            <button
              type="button"
              onClick={() => onApplyHeight(String(result.estimatedHeightCm))}
              className="mt-4 rounded-full bg-white px-4 py-2 text-xs font-bold text-[var(--brand-700)] shadow-sm"
            >
              {translate(language, "camera.applyHeight")}
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
