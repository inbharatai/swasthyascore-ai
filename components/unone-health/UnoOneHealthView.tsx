"use client";

import { useState } from "react";
import { BrainCircuit } from "lucide-react";
import type { Language, TranslationKey } from "@/lib/i18n";
import { translate } from "@/lib/i18n";
import { usePatientId } from "./usePatientId";
import { VitalScanScreen } from "./VitalScanScreen";
import { LabLensUpload } from "./LabLensUpload";
import { SymptomsInput } from "./SymptomsInput";
import { HealthAdvisoryView } from "./HealthAdvisoryView";
import { HealthTimeline } from "./HealthTimeline";
import { SafetyDisclaimer } from "@/components/SafetyDisclaimer";
import type {
  LabReportEvent,
  SymptomEvent,
  VitalScanResult,
} from "@/lib/unone-health";

type SubSection = "lab" | "scan" | "symptoms" | "advisory" | "timeline";

interface UnoOneHealthViewProps {
  language: Language;
  online: boolean;
  /** Deep-link target sub-section (e.g. the landing "Measure heart rate" CTA). */
  initialSection?: SubSection;
}

export function UnoOneHealthView({
  language,
  online,
  initialSection = "lab",
}: UnoOneHealthViewProps) {
  const patientId = usePatientId();
  const [section, setSection] = useState<SubSection>(initialSection);
  const [labReport, setLabReport] = useState<LabReportEvent | null>(null);
  const [vitals, setVitals] = useState<VitalScanResult | null>(null);
  const [symptoms, setSymptoms] = useState<SymptomEvent | null>(null);

  const tabs: { value: SubSection; key: string }[] = [
    { value: "lab", key: "unone.section.lab" },
    { value: "scan", key: "unone.section.scan" },
    { value: "symptoms", key: "unone.section.symptoms" },
    { value: "advisory", key: "unone.section.advisory" },
    { value: "timeline", key: "unone.section.timeline" },
  ];

  return (
    <div className="space-y-5">
      <section className="rounded-[34px] border border-white/70 bg-[linear-gradient(135deg,#eef2ff,#ecfdf5)] p-5 shadow-sm">
        <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-[var(--brand-700)]">
          <BrainCircuit className="h-4 w-4" />
          {translate(language, "unone.kicker")}
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--slate-950)]">
          {translate(language, "unone.title")}
        </h1>
        <p className="mt-2 text-sm leading-6 text-[var(--slate-600)]">
          {translate(language, "unone.subtitle")}
        </p>
        <p className="mt-4 rounded-[22px] bg-white/75 px-4 py-3 text-xs leading-5 text-[var(--slate-700)]">
          {translate(language, "unone.privacy")}
        </p>
      </section>

      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => {
          const selected = section === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => setSection(tab.value)}
              className={`rounded-full px-4 py-2 text-xs font-bold transition ${
                selected
                  ? "bg-[var(--brand-700)] text-white shadow-sm"
                  : "border border-[var(--border-soft)] bg-white text-[var(--slate-700)]"
              }`}
            >
              {translate(language, tab.key as TranslationKey)}
            </button>
          );
        })}
      </div>

      {section === "lab" ? (
        <LabLensUpload
          language={language}
          online={online}
          patientId={patientId}
          onLabReport={setLabReport}
        />
      ) : null}
      {section === "scan" ? (
        <VitalScanScreen
          language={language}
          online={online}
          patientId={patientId}
          onResult={setVitals}
        />
      ) : null}
      {section === "symptoms" ? (
        <SymptomsInput
          language={language}
          online={online}
          patientId={patientId}
          onSymptoms={setSymptoms}
        />
      ) : null}
      {section === "advisory" ? (
        <HealthAdvisoryView
          language={language}
          online={online}
          patientId={patientId}
          labReport={labReport}
          vitals={vitals}
          symptoms={symptoms}
        />
      ) : null}
      {section === "timeline" ? (
        <HealthTimeline language={language} patientId={patientId} />
      ) : null}

      <SafetyDisclaimer language={language} />
    </div>
  );
}