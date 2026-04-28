"use client";

import type {
  FamilyHistory,
  HealthFormChangeHandler,
  HealthFormData,
  PhysicalActivity,
  Symptom,
} from "@/lib/types/health";
import type { Language, TranslationKey } from "@/lib/i18n";
import { translate } from "@/lib/i18n";
import { SelectField, WizardCard } from "./ui/FormControls";
import { VoiceInputButton } from "./VoiceInputButton";

const symptomOptions: Array<{ value: Symptom; key: TranslationKey }> = [
  { value: "frequent_urination", key: "symptom.frequentUrination" },
  { value: "excessive_thirst", key: "symptom.excessiveThirst" },
  { value: "unexplained_weight_loss", key: "symptom.unexplainedWeightLoss" },
  { value: "blurred_vision", key: "symptom.blurredVision" },
  { value: "fatigue", key: "symptom.fatigue" },
  { value: "slow_wound_healing", key: "symptom.slowWoundHealing" },
  { value: "none", key: "symptom.none" },
];

interface SymptomsStepProps {
  language: Language;
  formData: HealthFormData;
  fieldErrors: Partial<Record<keyof HealthFormData, TranslationKey>>;
  onChange: HealthFormChangeHandler;
  onSymptomToggle: (symptom: Symptom) => void;
}

export function SymptomsStep({
  language,
  formData,
  fieldErrors,
  onChange,
  onSymptomToggle,
}: SymptomsStepProps) {
  return (
    <WizardCard
      eyebrow={translate(language, "wizard.riskFactors")}
      title={translate(language, "wizard.riskFactorsTitle")}
      description={translate(language, "wizard.riskFactorsHelp")}
    >
      <div className="grid gap-4">
        <SelectField
          label={translate(language, "form.activity")}
          value={formData.physicalActivity}
          onChange={(value) =>
            onChange("physicalActivity", value as PhysicalActivity | "")
          }
          placeholder="--"
          error={
            fieldErrors.physicalActivity
              ? translate(language, fieldErrors.physicalActivity)
              : undefined
          }
          options={[
            {
              value: "regular_active",
              label: translate(language, "activity.regularActive"),
            },
            { value: "moderate", label: translate(language, "activity.moderate") },
            {
              value: "sedentary",
              label: translate(language, "activity.sedentary"),
            },
          ]}
        />
        <SelectField
          label={translate(language, "form.familyHistory")}
          value={formData.familyHistory}
          onChange={(value) =>
            onChange("familyHistory", value as FamilyHistory | "")
          }
          placeholder="--"
          error={
            fieldErrors.familyHistory
              ? translate(language, fieldErrors.familyHistory)
              : undefined
          }
          options={[
            { value: "none", label: translate(language, "family.none") },
            {
              value: "one_parent",
              label: translate(language, "family.oneParent"),
            },
            {
              value: "both_parents",
              label: translate(language, "family.bothParents"),
            },
          ]}
        />

        <div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[var(--slate-800)]">
                {translate(language, "form.symptoms")}
              </p>
              <p className="mt-1 text-xs leading-5 text-[var(--slate-600)]">
                {translate(language, "form.symptomsHelper")}
              </p>
            </div>
            <VoiceInputButton
              language={language}
              onTranscript={(value) =>
                onChange(
                  "notes",
                  [formData.notes, value].filter(Boolean).join(" "),
                )
              }
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {symptomOptions.map((option) => {
              const selected = formData.symptoms.includes(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onSymptomToggle(option.value)}
                  className={`rounded-full border px-4 py-3 text-sm font-semibold transition ${
                    selected
                      ? "border-[var(--brand-700)] bg-[var(--brand-700)] text-white"
                      : "border-[var(--border-soft)] bg-white text-[var(--slate-700)]"
                  }`}
                >
                  {translate(language, option.key)}
                </button>
              );
            })}
          </div>
        </div>

        <label className="block">
          <span className="text-sm font-semibold text-[var(--slate-800)]">
            {translate(language, "form.notes")}
          </span>
          <textarea
            value={formData.notes}
            onChange={(event) => onChange("notes", event.target.value)}
            rows={4}
            className="mt-2 w-full rounded-[24px] border border-[var(--border-soft)] bg-white px-4 py-3 text-base text-[var(--slate-950)] shadow-sm outline-none transition focus:border-[var(--brand-700)] focus:ring-4 focus:ring-teal-100"
            placeholder={translate(language, "voice.help")}
          />
        </label>
      </div>
    </WizardCard>
  );
}
