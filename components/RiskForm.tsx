"use client";

import type { HTMLAttributes } from "react";
import type { Language } from "@/lib/i18n";
import { translate } from "@/lib/i18n";
import type {
  FamilyHistory,
  Gender,
  HealthFormData,
  PhysicalActivity,
  Symptom,
} from "@/lib/types/health";
import { VoiceInputButton } from "./VoiceInputButton";

interface RiskFormProps {
  language: Language;
  formData: HealthFormData;
  fieldErrors: Partial<Record<keyof HealthFormData, string>>;
  onChange: <K extends keyof HealthFormData>(field: K, value: HealthFormData[K]) => void;
  onSymptomToggle: (symptom: Symptom) => void;
  onSubmit: () => void;
  onReset: () => void;
}

function InputField(props: {
  label: string;
  helper?: string;
  unit?: string;
  error?: string;
  value: string;
  type?: "text" | "number";
  inputMode?: HTMLAttributes<HTMLInputElement>["inputMode"];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-[var(--slate-800)]">
        {props.label}
      </span>
      <div className="flex rounded-[22px] border border-[var(--border-soft)] bg-white px-4 py-3 shadow-sm">
        <input
          type={props.type ?? "text"}
          inputMode={props.inputMode}
          value={props.value}
          onChange={(event) => props.onChange(event.target.value)}
          className="w-full bg-transparent text-base outline-none placeholder:text-[var(--slate-400)]"
        />
        {props.unit ? (
          <span className="ml-3 text-sm font-semibold text-[var(--slate-500)]">
            {props.unit}
          </span>
        ) : null}
      </div>
      {props.helper ? (
        <span className="mt-2 block text-xs leading-5 text-[var(--slate-500)]">
          {props.helper}
        </span>
      ) : null}
      {props.error ? (
        <span className="mt-2 block text-xs font-semibold text-rose-700">
          {props.error}
        </span>
      ) : null}
    </label>
  );
}

function SelectField(props: {
  label: string;
  helper?: string;
  error?: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-[var(--slate-800)]">
        {props.label}
      </span>
      <select
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        className="w-full rounded-[22px] border border-[var(--border-soft)] bg-white px-4 py-3 text-base text-[var(--slate-900)] shadow-sm outline-none"
      >
        <option value="">--</option>
        {props.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {props.helper ? (
        <span className="mt-2 block text-xs leading-5 text-[var(--slate-500)]">
          {props.helper}
        </span>
      ) : null}
      {props.error ? (
        <span className="mt-2 block text-xs font-semibold text-rose-700">
          {props.error}
        </span>
      ) : null}
    </label>
  );
}

export function RiskForm({
  language,
  formData,
  fieldErrors,
  onChange,
  onSymptomToggle,
  onSubmit,
  onReset,
}: RiskFormProps) {
  const symptomOptions: Array<{ value: Symptom; label: string }> = [
    {
      value: "frequent_urination",
      label: translate(language, "symptom.frequentUrination"),
    },
    {
      value: "excessive_thirst",
      label: translate(language, "symptom.excessiveThirst"),
    },
    {
      value: "unexplained_weight_loss",
      label: translate(language, "symptom.unexplainedWeightLoss"),
    },
    { value: "blurred_vision", label: translate(language, "symptom.blurredVision") },
    { value: "fatigue", label: translate(language, "symptom.fatigue") },
    {
      value: "slow_wound_healing",
      label: translate(language, "symptom.slowWoundHealing"),
    },
    { value: "none", label: translate(language, "symptom.none") },
  ];

  const activityOptions: Array<{ value: PhysicalActivity; label: string }> = [
    {
      value: "regular_active",
      label: translate(language, "activity.regularActive"),
    },
    { value: "moderate", label: translate(language, "activity.moderate") },
    { value: "sedentary", label: translate(language, "activity.sedentary") },
  ];

  const familyHistoryOptions: Array<{ value: FamilyHistory; label: string }> = [
    { value: "none", label: translate(language, "family.none") },
    { value: "one_parent", label: translate(language, "family.oneParent") },
    { value: "both_parents", label: translate(language, "family.bothParents") },
  ];

  const genderOptions: Array<{ value: Gender; label: string }> = [
    { value: "male", label: translate(language, "form.male") },
    { value: "female", label: translate(language, "form.female") },
  ];

  return (
    <section
      id="risk-form"
      className="rounded-[32px] border border-[var(--border-soft)] bg-white/95 p-5 shadow-sm sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--brand-700)]">
            {translate(language, "section.step2")}
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--slate-950)]">
            {translate(language, "section.form")}
          </h2>
        </div>
        <span className="rounded-full bg-[var(--surface-muted)] px-4 py-2 text-xs font-semibold text-[var(--slate-700)]">
          {translate(language, "app.offlineReady")}
        </span>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <InputField
          label={`${translate(language, "form.name")} (${translate(language, "common.optional")})`}
          value={formData.name}
          onChange={(value) => onChange("name", value)}
        />
        <InputField
          label={translate(language, "form.age")}
          helper={translate(language, "form.ageHelper")}
          unit={translate(language, "form.units.years")}
          value={formData.age}
          type="number"
          inputMode="numeric"
          error={fieldErrors.age}
          onChange={(value) => onChange("age", value)}
        />
        <SelectField
          label={translate(language, "form.gender")}
          helper={translate(language, "form.genderHelper")}
          value={formData.gender}
          options={genderOptions}
          error={fieldErrors.gender}
          onChange={(value) => onChange("gender", value as HealthFormData["gender"])}
        />
        <SelectField
          label={translate(language, "form.activity")}
          value={formData.physicalActivity}
          options={activityOptions}
          error={fieldErrors.physicalActivity}
          onChange={(value) =>
            onChange("physicalActivity", value as HealthFormData["physicalActivity"])
          }
        />
        <InputField
          label={translate(language, "form.height")}
          unit={translate(language, "form.units.cm")}
          value={formData.heightCm}
          type="number"
          inputMode="decimal"
          error={fieldErrors.heightCm}
          onChange={(value) => onChange("heightCm", value)}
        />
        <InputField
          label={translate(language, "form.weight")}
          unit={translate(language, "form.units.kg")}
          value={formData.weightKg}
          type="number"
          inputMode="decimal"
          error={fieldErrors.weightKg}
          onChange={(value) => onChange("weightKg", value)}
        />
        <InputField
          label={translate(language, "form.waist")}
          helper={translate(language, "form.waistHelper")}
          unit={translate(language, "form.units.cm")}
          value={formData.waistCm}
          type="number"
          inputMode="decimal"
          error={fieldErrors.waistCm}
          onChange={(value) => onChange("waistCm", value)}
        />
        <SelectField
          label={translate(language, "form.familyHistory")}
          value={formData.familyHistory}
          options={familyHistoryOptions}
          error={fieldErrors.familyHistory}
          onChange={(value) =>
            onChange("familyHistory", value as HealthFormData["familyHistory"])
          }
        />
        <InputField
          label={`${translate(language, "form.systolic")} (${translate(language, "common.optional")})`}
          helper={translate(language, "form.bpHelper")}
          unit={translate(language, "form.units.mmhg")}
          value={formData.systolicBp}
          type="number"
          inputMode="numeric"
          error={fieldErrors.systolicBp}
          onChange={(value) => onChange("systolicBp", value)}
        />
        <InputField
          label={`${translate(language, "form.diastolic")} (${translate(language, "common.optional")})`}
          unit={translate(language, "form.units.mmhg")}
          value={formData.diastolicBp}
          type="number"
          inputMode="numeric"
          error={fieldErrors.diastolicBp}
          onChange={(value) => onChange("diastolicBp", value)}
        />
        <InputField
          label={`${translate(language, "form.hba1c")} (${translate(language, "common.optional")})`}
          helper={translate(language, "form.labHelper")}
          unit={translate(language, "form.units.percent")}
          value={formData.hba1c}
          type="number"
          inputMode="decimal"
          error={fieldErrors.hba1c}
          onChange={(value) => onChange("hba1c", value)}
        />
        <InputField
          label={`${translate(language, "form.fasting")} (${translate(language, "common.optional")})`}
          unit={translate(language, "form.units.mgdl")}
          value={formData.fastingGlucose}
          type="number"
          inputMode="numeric"
          error={fieldErrors.fastingGlucose}
          onChange={(value) => onChange("fastingGlucose", value)}
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <InputField
          label={`${translate(language, "form.random")} (${translate(language, "common.optional")})`}
          unit={translate(language, "form.units.mgdl")}
          value={formData.randomGlucose}
          type="number"
          inputMode="numeric"
          error={fieldErrors.randomGlucose}
          onChange={(value) => onChange("randomGlucose", value)}
        />
        <div className="rounded-[28px] border border-[var(--border-soft)] bg-[var(--surface-muted)] p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[var(--slate-800)]">
                {translate(language, "form.notes")}
              </p>
              <p className="mt-1 text-xs leading-5 text-[var(--slate-500)]">
                {translate(language, "form.notesHelper")}
              </p>
            </div>
            <VoiceInputButton
              language={language}
              onTranscript={(value) =>
                onChange("notes", formData.notes ? `${formData.notes} ${value}` : value)
              }
            />
          </div>
          <textarea
            value={formData.notes}
            onChange={(event) => onChange("notes", event.target.value)}
            rows={4}
            className="mt-4 w-full rounded-[22px] border border-white/60 bg-white px-4 py-3 text-sm outline-none placeholder:text-[var(--slate-400)]"
          />
        </div>
      </div>

      <div className="mt-6">
        <p className="text-sm font-semibold text-[var(--slate-800)]">
          {translate(language, "form.symptoms")}
        </p>
        <p className="mt-1 text-xs leading-5 text-[var(--slate-500)]">
          {translate(language, "form.symptomsHelper")}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          {symptomOptions.map((option) => {
            const checked = formData.symptoms.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onSymptomToggle(option.value)}
                className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                  checked
                    ? "border-[var(--brand-700)] bg-[var(--brand-700)] text-white"
                    : "border-[var(--border-soft)] bg-white text-[var(--slate-700)]"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <p className="mt-6 rounded-2xl bg-[var(--surface-muted)] px-4 py-3 text-sm leading-6 text-[var(--slate-700)]">
        {translate(language, "form.aiConsent")}
      </p>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={onSubmit}
          className="inline-flex items-center justify-center rounded-full bg-[var(--brand-700)] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--brand-800)]"
        >
          {translate(language, "form.calculate")}
        </button>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center justify-center rounded-full bg-white px-5 py-3 text-sm font-semibold text-[var(--slate-700)] shadow-sm ring-1 ring-[var(--border-soft)] transition hover:bg-[var(--surface-muted)]"
        >
          {translate(language, "form.reset")}
        </button>
      </div>
    </section>
  );
}
