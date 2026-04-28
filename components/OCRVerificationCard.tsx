import type {
  HealthFormChangeHandler,
  HealthFormData,
} from "@/lib/types/health";
import type { Language, TranslationKey } from "@/lib/i18n";
import { translate } from "@/lib/i18n";
import { TextField } from "./ui/FormControls";

interface OCRVerificationCardProps {
  language: Language;
  formData: HealthFormData;
  fieldErrors: Partial<Record<keyof HealthFormData, TranslationKey>>;
  onChange: HealthFormChangeHandler;
  onOpenRisk: () => void;
}

export function OCRVerificationCard({
  language,
  formData,
  fieldErrors,
  onChange,
  onOpenRisk,
}: OCRVerificationCardProps) {
  return (
    <section className="rounded-[30px] border border-white/70 bg-white/95 p-5 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--brand-700)]">
        {translate(language, "ocr.verifyTitle")}
      </p>
      <h2 className="mt-2 text-xl font-semibold text-[var(--slate-950)]">
        {translate(language, "ocr.verifyHeading")}
      </h2>
      <p className="mt-2 text-sm leading-6 text-[var(--slate-600)]">
        {translate(language, "ocr.verifyDescription")}
      </p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
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
        <TextField
          label={translate(language, "form.systolic")}
          value={formData.systolicBp}
          onChange={(value) => onChange("systolicBp", value)}
          type="number"
          inputMode="numeric"
          unit={translate(language, "form.units.mmhg")}
          optional={translate(language, "common.optional")}
        />
        <TextField
          label={translate(language, "form.diastolic")}
          value={formData.diastolicBp}
          onChange={(value) => onChange("diastolicBp", value)}
          type="number"
          inputMode="numeric"
          unit={translate(language, "form.units.mmhg")}
          optional={translate(language, "common.optional")}
        />
      </div>
      <button
        type="button"
        onClick={onOpenRisk}
        className="mt-5 min-h-12 w-full rounded-full bg-[var(--brand-700)] px-5 text-sm font-bold text-white shadow-sm"
      >
        {translate(language, "ocr.useInRisk")}
      </button>
    </section>
  );
}
