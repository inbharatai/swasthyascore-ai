"use client";

import { useState } from "react";
import type { Language } from "@/lib/i18n";
import { translate } from "@/lib/i18n";
import {
  cmToFeetInches,
  feetInchesToCm,
  isValidFeetInches,
  isValidHeightCm,
  roundOneDecimal,
} from "@/lib/utils/units";
import { TextField } from "./ui/FormControls";

type HeightMode = "cm" | "ft_in";

interface HeightInputProps {
  language: Language;
  valueCm: string;
  onChangeCm: (value: string) => void;
  error?: string;
}

function parseDecimal(value: string): number | null {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function HeightInput({
  language,
  valueCm,
  onChangeCm,
  error,
}: HeightInputProps) {
  const [mode, setMode] = useState<HeightMode>("cm");
  const [feet, setFeet] = useState("");
  const [inches, setInches] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  function handleModeChange(nextMode: HeightMode) {
    setMode(nextMode);
    setLocalError(null);

    if (nextMode === "ft_in") {
      const heightCm = parseDecimal(valueCm);
      if (heightCm != null && isValidHeightCm(heightCm)) {
        const converted = cmToFeetInches(heightCm);
        setFeet(String(converted.feet));
        setInches(String(converted.inches));
      }
    }
  }

  function updateFeetInches(nextFeet: string, nextInches: string) {
    setFeet(nextFeet);
    setInches(nextInches);

    const parsedFeet = parseDecimal(nextFeet);
    const parsedInches = nextInches.trim() ? parseDecimal(nextInches) : 0;

    if (parsedFeet == null || parsedInches == null) {
      onChangeCm("");
      setLocalError(null);
      return;
    }

    if (!isValidFeetInches(parsedFeet, parsedInches)) {
      onChangeCm("");
      setLocalError(translate(language, "validation.heightFeetInchesRange"));
      return;
    }

    const heightCm = roundOneDecimal(feetInchesToCm(parsedFeet, parsedInches));
    if (!isValidHeightCm(heightCm)) {
      onChangeCm("");
      setLocalError(translate(language, "validation.heightRange"));
      return;
    }

    setLocalError(null);
    onChangeCm(String(heightCm));
  }

  const convertedCm =
    mode === "ft_in" && valueCm ? roundOneDecimal(Number(valueCm)) : null;

  return (
    <section className="rounded-[28px] border border-[var(--border-soft)] bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-[var(--slate-950)]">
            {translate(language, "form.height")}
          </p>
          <p className="mt-1 text-xs leading-5 text-[var(--slate-600)]">
            {translate(language, "form.heightHelper")}
          </p>
        </div>
        <div className="inline-flex rounded-full bg-[var(--surface-muted)] p-1">
          {(["cm", "ft_in"] as const).map((option) => (
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
                option === "cm" ? "form.units.cm" : "form.units.ftIn",
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4">
        {mode === "cm" ? (
          <TextField
            label={translate(language, "form.heightCm")}
            value={valueCm}
            onChange={onChangeCm}
            type="number"
            inputMode="decimal"
            unit={translate(language, "form.units.cm")}
            error={error}
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField
              label={translate(language, "form.heightFeet")}
              value={feet}
              onChange={(value) => updateFeetInches(value, inches)}
              type="number"
              inputMode="decimal"
              unit={translate(language, "form.units.feet")}
              error={localError ?? undefined}
            />
            <TextField
              label={translate(language, "form.heightInches")}
              value={inches}
              onChange={(value) => updateFeetInches(feet, value)}
              type="number"
              inputMode="decimal"
              unit={translate(language, "form.units.inches")}
            />
          </div>
        )}
      </div>

      {mode === "ft_in" && convertedCm ? (
        <p className="mt-3 rounded-2xl bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800">
          {translate(language, "form.convertedHeight", {
            value: convertedCm,
          })}
        </p>
      ) : null}
    </section>
  );
}
