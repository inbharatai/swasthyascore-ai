import type {
  HealthFormChangeHandler,
  HealthFormData,
} from "@/lib/types/health";
import type { Language, TranslationKey } from "@/lib/i18n";
import { translate } from "@/lib/i18n";
import { SelectField, TextField, WizardCard } from "./ui/FormControls";

interface BasicDetailsStepProps {
  language: Language;
  formData: HealthFormData;
  fieldErrors: Partial<Record<keyof HealthFormData, TranslationKey>>;
  onChange: HealthFormChangeHandler;
}

export function BasicDetailsStep({
  language,
  formData,
  fieldErrors,
  onChange,
}: BasicDetailsStepProps) {
  return (
    <WizardCard
      eyebrow={translate(language, "wizard.basic")}
      title={translate(language, "wizard.basicTitle")}
      description={translate(language, "wizard.basicHelp")}
    >
      <div className="grid gap-4">
        <TextField
          label={translate(language, "form.name")}
          value={formData.name}
          onChange={(value) => onChange("name", value)}
          optional={translate(language, "common.optional")}
          placeholder={translate(language, "wizard.namePlaceholder")}
        />
        <TextField
          label={translate(language, "form.age")}
          value={formData.age}
          onChange={(value) => onChange("age", value)}
          type="number"
          inputMode="numeric"
          unit={translate(language, "form.units.years")}
          helper={translate(language, "form.ageHelper")}
          error={
            fieldErrors.age ? translate(language, fieldErrors.age) : undefined
          }
        />
        <SelectField
          label={translate(language, "form.gender")}
          value={formData.gender}
          onChange={(value) =>
            onChange("gender", value as HealthFormData["gender"])
          }
          placeholder="--"
          helper={translate(language, "form.genderHelper")}
          error={
            fieldErrors.gender
              ? translate(language, fieldErrors.gender)
              : undefined
          }
          options={[
            { value: "male", label: translate(language, "form.male") },
            { value: "female", label: translate(language, "form.female") },
          ]}
        />
      </div>
    </WizardCard>
  );
}
