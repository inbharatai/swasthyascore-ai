import { Camera } from "lucide-react";
import type {
  HealthFormChangeHandler,
  HealthFormData,
} from "@/lib/types/health";
import type { Language, TranslationKey } from "@/lib/i18n";
import { translate } from "@/lib/i18n";
import { HeightInput } from "./HeightInput";
import { TextField, WizardCard } from "./ui/FormControls";
import { WeightInput } from "./WeightInput";

interface MeasurementStepProps {
  language: Language;
  formData: HealthFormData;
  fieldErrors: Partial<Record<keyof HealthFormData, TranslationKey>>;
  onChange: HealthFormChangeHandler;
  onOpenCamera: () => void;
}

export function MeasurementStep({
  language,
  formData,
  fieldErrors,
  onChange,
  onOpenCamera,
}: MeasurementStepProps) {
  return (
    <WizardCard
      eyebrow={translate(language, "wizard.measurements")}
      title={translate(language, "wizard.measurementsTitle")}
      description={translate(language, "wizard.measurementsHelp")}
    >
      <div className="grid gap-4">
        <div className="rounded-[26px] border border-cyan-100 bg-cyan-50 p-4">
          <div className="flex items-start gap-3">
            <span className="rounded-2xl bg-white p-3 text-cyan-700 shadow-sm">
              <Camera className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-bold text-cyan-950">
                {translate(language, "wizard.cameraAssistTitle")}
              </p>
              <p className="mt-1 text-xs leading-5 text-cyan-800">
                {translate(language, "wizard.cameraAssistDescription")}
              </p>
              <button
                type="button"
                onClick={onOpenCamera}
                className="mt-3 rounded-full bg-cyan-700 px-4 py-2 text-xs font-bold text-white"
              >
                {translate(language, "wizard.openCamera")}
              </button>
            </div>
          </div>
        </div>
        <HeightInput
          language={language}
          valueCm={formData.heightCm}
          onChangeCm={(value) => onChange("heightCm", value)}
          error={
            fieldErrors.heightCm
              ? translate(language, fieldErrors.heightCm)
              : undefined
          }
        />
        <WeightInput
          language={language}
          valueKg={formData.weightKg}
          onChangeKg={(value) => onChange("weightKg", value)}
          error={
            fieldErrors.weightKg
              ? translate(language, fieldErrors.weightKg)
              : undefined
          }
        />
        <TextField
          label={translate(language, "form.waist")}
          value={formData.waistCm}
          onChange={(value) => onChange("waistCm", value)}
          type="number"
          inputMode="decimal"
          unit={translate(language, "form.units.cm")}
          helper={translate(language, "form.waistHelper")}
          error={
            fieldErrors.waistCm
              ? translate(language, fieldErrors.waistCm)
              : undefined
          }
        />
      </div>
    </WizardCard>
  );
}
