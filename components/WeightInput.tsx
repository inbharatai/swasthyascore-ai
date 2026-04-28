"use client";

import { useState } from "react";
import type { Language } from "@/lib/i18n";
import { translate } from "@/lib/i18n";
import {
  isValidWeightKg,
  kgToPounds,
  poundsToKg,
  roundOneDecimal,
} from "@/lib/utils/units";
import { TextField } from "./ui/FormControls";

type WeightMode = "kg" | "lbs";

interface WeightInputProps {
  language: Language;
  valueKg: string;
  onChangeKg: (value: string) => void;
  error?: string;
}

function parseDecimal(value: string): number | null {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function WeightInput({
  language,
  valueKg,
  onChangeKg,
  error,
}: WeightInputProps) {
  const [mode, setMode] = useState<WeightMode>("kg");
  const [pounds, setPounds] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  function handleModeChange(nextMode: WeightMode) {
    setMode(nextMode);
    setLocalError(null);

    if (nextMode === "lbs") {
      const weightKg = parseDecimal(valueKg);
      if (weightKg != null && isValidWeightKg(weightKg)) {
        setPounds(String(roundOneDecimal(kgToPounds(weightKg))));
      }
    }
  }

  function handlePoundsChange(value: string) {
    setPounds(value);
    const parsed = parseDecimal(value);

    if (parsed == null) {
      onChangeKg("");
      setLocalError(null);
      return;
    }

    const kg = roundOneDecimal(poundsToKg(parsed));
    if (!isValidWeightKg(kg)) {
      onChangeKg("");
      setLocalError(translate(language, "validation.weightPoundsRange"));
      return;
    }

    setLocalError(null);
    onChangeKg(String(kg));
  }

  const convertedKg =
    mode === "lbs" && valueKg ? roundOneDecimal(Number(valueKg)) : null;

  return (
    <section className="rounded-[28px] border border-[var(--border-soft)] bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-[var(--slate-950)]">
            {translate(language, "form.weight")}
          </p>
          <p className="mt-1 text-xs leading-5 text-[var(--slate-600)]">
            {translate(language, "form.weightHelper")}
          </p>
        </div>
        <div className="inline-flex rounded-full bg-[var(--surface-muted)] p-1">
          {(["kg", "lbs"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => handleModeChange(option)}
              className={`rounded-full px-3 py-2 text-xs font-bold transition ${
                mode === option
                  ? "bg-[var(--brand-700)] text-white shadow-sm"
                  : "text-[var(--slate-600)]"
              }`}
            >
              {translate(
                language,
                option === "kg" ? "form.units.kg" : "form.units.lbs",
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4">
        {mode === "kg" ? (
          <TextField
            label={translate(language, "form.weightKg")}
            value={valueKg}
            onChange={onChangeKg}
            type="number"
            inputMode="decimal"
            unit={translate(language, "form.units.kg")}
            error={error}
          />
        ) : (
          <TextField
            label={translate(language, "form.weightLbs")}
            value={pounds}
            onChange={handlePoundsChange}
            type="number"
            inputMode="decimal"
            unit={translate(language, "form.units.lbs")}
            error={localError ?? undefined}
          />
        )}
      </div>

      {mode === "lbs" && convertedKg ? (
        <p className="mt-3 rounded-2xl bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800">
          {translate(language, "form.convertedWeight", {
            value: convertedKg,
          })}
        </p>
      ) : null}
    </section>
  );
}
