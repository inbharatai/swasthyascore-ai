"use client";

import { useState } from "react";
import { Stethoscope, Users, Salad, ShieldAlert } from "lucide-react";
import type { Language } from "@/lib/i18n";
import { translate } from "@/lib/i18n";
import type {
  HealthAdvisory,
  LabReportEvent,
  SymptomEvent,
  VitalScanResult,
} from "@/lib/unone-health";
import { getSwasthyakAdapter } from "@/modules/unone-health/adapters/swasthyak-adapter/SwasthyakAdapter";

interface HealthAdvisoryViewProps {
  language: Language;
  online: boolean;
  patientId: string;
  labReport: LabReportEvent | null;
  vitals: VitalScanResult | null;
  symptoms: SymptomEvent | null;
}

export function HealthAdvisoryView({
  language,
  online,
  patientId,
  labReport,
  vitals,
  symptoms,
}: HealthAdvisoryViewProps) {
  const [age, setAge] = useState("");
  const [sex, setSex] = useState("");
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [advisory, setAdvisory] = useState<HealthAdvisory | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setError(null);
    if (!consent) {
      setError(translate(language, "unone.consentRequired"));
      return;
    }
    if (!online) {
      setError(translate(language, "unone.advisory.offline"));
      return;
    }
    setLoading(true);
    try {
      const result = await getSwasthyakAdapter().generateAdvisory({
        patient_id: patientId,
        consent_given: consent,
        profile: {
          age: age ? Number(age) : undefined,
          sex: sex || undefined,
        },
        lab_report: labReport,
        vitals,
        symptoms,
      });
      setAdvisory(result);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-4 rounded-[30px] border border-white/70 bg-white/95 p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-[var(--slate-950)]">
        {translate(language, "unone.section.advisory")}
      </h2>

      <p className="text-sm text-[var(--slate-600)]">
        {labReport ? "Lab report attached. " : "No lab report yet. "}
        {vitals ? "Vital scan attached. " : "No vital scan yet. "}
        {symptoms ? "Symptoms attached." : "No symptoms yet."}
      </p>

      <div className="grid grid-cols-2 gap-3">
        <input
          type="number"
          value={age}
          onChange={(e) => setAge(e.target.value)}
          placeholder="Age"
          className="rounded-full border border-[var(--border-soft)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--brand-700)]"
        />
        <select
          value={sex}
          onChange={(e) => setSex(e.target.value)}
          className="rounded-full border border-[var(--border-soft)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--brand-700)]"
        >
          <option value="">Sex</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
          <option value="other">Other</option>
        </select>
      </div>

      <label className="flex items-start gap-3 rounded-[22px] bg-[var(--surface-muted)] p-4 text-sm text-[var(--slate-800)]">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
        />
        <span>{translate(language, "unone.consentAdvisory")}</span>
      </label>

      <button
        type="button"
        disabled={loading || !online}
        onClick={handleGenerate}
        className="rounded-full bg-[var(--brand-700)] px-5 py-3 text-sm font-bold text-white shadow-sm disabled:opacity-50"
      >
        {translate(language, "unone.advisory.generate")}
      </button>

      {error ? (
        <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
      ) : null}

      {advisory ? (
        <div className="space-y-4">
          <div className="rounded-2xl bg-[var(--surface-muted)] px-4 py-3">
            <strong className="text-sm text-[var(--slate-900)]">
              {translate(language, "unone.advisory.risk")}:{" "}
            </strong>
            <span className="text-sm font-bold text-[var(--brand-700)]">
              {advisory.risk_level}
            </span>
            {advisory.repeat_scan_recommended ? (
              <p className="mt-1 text-xs text-amber-700">
                {translate(language, "unone.advisory.repeat")}
              </p>
            ) : null}
          </div>

          <p className="text-sm text-[var(--slate-800)]">{advisory.user_message}</p>

          <div>
            <h3 className="text-sm font-bold text-[var(--slate-950)]">
              {translate(language, "unone.advisory.findings")}
            </h3>
            <ul className="mt-2 space-y-2">
              {advisory.top_findings.map((finding) => (
                <li key={finding.title} className="rounded-2xl border border-[var(--border-soft)] bg-white p-3 text-sm">
                  <p className="font-semibold text-[var(--slate-900)]">{finding.title}</p>
                  <p className="mt-1 text-[var(--slate-700)]">{finding.why_it_matters}</p>
                  <p className="mt-1 text-xs text-[var(--brand-700)]">{finding.recommended_next_step}</p>
                </li>
              ))}
            </ul>
          </div>

          <LifestylePlan language={language} plan={advisory.lifestyle_plan} />

          <div className="rounded-2xl bg-sky-50 p-4">
            <p className="inline-flex items-center gap-2 text-sm font-bold text-sky-900">
              <Stethoscope className="h-4 w-4" />
              {translate(language, "unone.advisory.doctor")}
            </p>
            <p className="mt-1 text-sm text-sky-900">{advisory.doctor_summary}</p>
          </div>

          <div className="rounded-2xl bg-emerald-50 p-4">
            <p className="inline-flex items-center gap-2 text-sm font-bold text-emerald-900">
              <Users className="h-4 w-4" />
              {translate(language, "unone.advisory.family")}
            </p>
            <p className="mt-1 text-sm text-emerald-900">{advisory.family_summary}</p>
          </div>

          <div className="rounded-2xl bg-amber-50 p-4">
            <p className="inline-flex items-center gap-2 text-sm font-bold text-amber-900">
              <ShieldAlert className="h-4 w-4" />
              {translate(language, "unone.advisory.safety")}
            </p>
            <p className="mt-1 text-sm text-amber-900">{advisory.safety_note}</p>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function LifestylePlan({
  language,
  plan,
}: {
  language: Language;
  plan: HealthAdvisory["lifestyle_plan"];
}) {
  const groups: { key: string; items: string[] }[] = [
    { key: "Diet", items: plan.diet },
    { key: "Activity", items: plan.activity },
    { key: "Sleep", items: plan.sleep },
    { key: "Hydration", items: plan.hydration },
    { key: "Avoid", items: plan.avoid },
    { key: "Follow up", items: plan.follow_up },
  ];
  const nonEmpty = groups.filter((g) => g.items.length > 0);
  if (nonEmpty.length === 0) return null;
  return (
    <div className="rounded-2xl border border-[var(--border-soft)] bg-white p-4">
      <h3 className="inline-flex items-center gap-2 text-sm font-bold text-[var(--slate-950)]">
        <Salad className="h-4 w-4 text-[var(--brand-700)]" />
        {translate(language, "unone.advisory.lifestyle")}
      </h3>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        {nonEmpty.map((group) => (
          <div key={group.key} className="rounded-xl bg-[var(--surface-muted)] p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-[var(--brand-700)]">
              {group.key}
            </p>
            <ul className="mt-1 list-disc pl-4 text-sm text-[var(--slate-700)]">
              {group.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}