import type {
  HealthFormChangeHandler,
  HealthFormData,
} from "@/lib/types/health";
import type { Language, TranslationKey } from "@/lib/i18n";
import { translate } from "@/lib/i18n";
import { TextField, WizardCard } from "./ui/FormControls";

interface LabValuesStepProps {
  language: Language;
  formData: HealthFormData;
  fieldErrors: Partial<Record<keyof HealthFormData, TranslationKey>>;
  onChange: HealthFormChangeHandler;
  onOpenLab: () => void;
}

export function LabValuesStep({
  language,
  formData,
  fieldErrors,
  onChange,
  onOpenLab,
}: LabValuesStepProps) {
  return (
    <WizardCard
      eyebrow={translate(language, "wizard.labs")}
      title={translate(language, "wizard.labsTitle")}
      description={translate(language, "wizard.labsHelp")}
    >
      <div className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label={translate(language, "form.systolic")}
            value={formData.systolicBp}
            onChange={(value) => onChange("systolicBp", value)}
            type="number"
            inputMode="numeric"
            unit={translate(language, "form.units.mmhg")}
            optional={translate(language, "common.optional")}
            error={
              fieldErrors.systolicBp
                ? translate(language, fieldErrors.systolicBp)
                : undefined
            }
          />
          <TextField
            label={translate(language, "form.diastolic")}
            value={formData.diastolicBp}
            onChange={(value) => onChange("diastolicBp", value)}
            type="number"
            inputMode="numeric"
            unit={translate(language, "form.units.mmhg")}
            optional={translate(language, "common.optional")}
            error={
              fieldErrors.diastolicBp
                ? translate(language, fieldErrors.diastolicBp)
                : undefined
            }
          />
        </div>
        <p className="rounded-[22px] bg-[var(--surface-muted)] px-4 py-3 text-xs leading-5 text-[var(--slate-600)]">
          {translate(language, "form.bpHelper")}
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField
            label={translate(language, "form.hba1c")}
            value={formData.hba1c}
            onChange={(value) => onChange("hba1c", value)}
            type="number"
            inputMode="decimal"
            unit={translate(language, "form.units.percent")}
            optional={translate(language, "common.optional")}
            error={
              fieldErrors.hba1c
                ? translate(language, fieldErrors.hba1c)
                : undefined
            }
          />
          <TextField
            label={translate(language, "form.fasting")}
            value={formData.fastingGlucose}
            onChange={(value) => onChange("fastingGlucose", value)}
            type="number"
            inputMode="decimal"
            unit={translate(language, "form.units.mgdl")}
            optional={translate(language, "common.optional")}
            error={
              fieldErrors.fastingGlucose
                ? translate(language, fieldErrors.fastingGlucose)
                : undefined
            }
          />
          <TextField
            label={translate(language, "form.random")}
            value={formData.randomGlucose}
            onChange={(value) => onChange("randomGlucose", value)}
            type="number"
            inputMode="decimal"
            unit={translate(language, "form.units.mgdl")}
            optional={translate(language, "common.optional")}
            error={
              fieldErrors.randomGlucose
                ? translate(language, fieldErrors.randomGlucose)
                : undefined
            }
          />
        </div>
        <button
          type="button"
          onClick={onOpenLab}
          className="rounded-full border border-[var(--border-soft)] bg-white px-5 py-3 text-sm font-bold text-[var(--brand-700)] shadow-sm"
        >
          {translate(language, "wizard.openLab")}
        </button>
      </div>
    </WizardCard>
  );
}
