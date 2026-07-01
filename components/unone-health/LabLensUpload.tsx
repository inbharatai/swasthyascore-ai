"use client";

import { useState } from "react";
import { AlertTriangle, FileText, Upload } from "lucide-react";
import type { Language } from "@/lib/i18n";
import { translate } from "@/lib/i18n";
import type { LabReportEvent } from "@/lib/unone-health";
import { getSwasthyakAdapter } from "@/modules/unone-health/adapters/swasthyak-adapter/SwasthyakAdapter";

interface LabLensUploadProps {
  language: Language;
  online: boolean;
  patientId: string;
  onLabReport: (event: LabReportEvent) => void;
}

export function LabLensUpload({
  language,
  online,
  patientId,
  onLabReport,
}: LabLensUploadProps) {
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<LabReportEvent | null>(null);

  async function handleFile(file: File) {
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
      const adapter = getSwasthyakAdapter();
      const { report_id } = await adapter.uploadLabReport({
        file,
        filename: file.name,
        mimeType: file.type,
        patientId,
        consentGiven: consent,
      });
      const event = await adapter.analyzeLabReport({
        reportId: report_id,
        patientId,
        consentGiven: consent,
      });
      setReport(event);
      onLabReport(event);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : translate(language, "unone.lab.error.generic"),
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-4 rounded-[30px] border border-white/70 bg-white/95 p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-[var(--slate-950)]">
        {translate(language, "unone.section.lab")}
      </h2>

      <label className="flex items-start gap-3 rounded-[22px] bg-[var(--surface-muted)] p-4 text-sm text-[var(--slate-800)]">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
        />
        <span>{translate(language, "unone.consentLab")}</span>
      </label>

      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[26px] border-2 border-dashed border-[var(--border-soft)] bg-[var(--surface-muted)] p-8 text-center">
        <Upload className="h-6 w-6 text-[var(--brand-700)]" />
        <span className="text-sm font-semibold text-[var(--slate-800)]">
          {translate(language, "unone.lab.drop")}
        </span>
        <span className="text-xs text-[var(--slate-600)]">
          {translate(language, "unone.lab.accepted")}
        </span>
        <input
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />
      </label>

      {loading ? (
        <p className="text-sm font-semibold text-[var(--brand-700)]">
          {translate(language, "unone.lab.analyzing")}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
      ) : null}

      {report ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-2xl bg-[var(--surface-muted)] px-4 py-3">
            <span className="inline-flex items-center gap-2 text-sm font-bold text-[var(--slate-900)]">
              <FileText className="h-4 w-4 text-[var(--brand-700)]" />
              {translate(language, "unone.lab.confidence")}: {Math.round(report.confidence * 100)}%
            </span>
          </div>

          {report.critical_flags.length > 0 ? (
            <div className="rounded-2xl bg-red-50 p-4">
              <p className="inline-flex items-center gap-2 text-sm font-bold text-red-800">
                <AlertTriangle className="h-4 w-4" />
                {translate(language, "unone.lab.critical")}
              </p>
              <ul className="mt-2 list-disc pl-5 text-sm text-red-700">
                {report.critical_flags.map((flag, index) => (
                  <li key={`${index}-${flag}`}>{flag}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div>
            <h3 className="text-sm font-bold text-[var(--slate-950)]">
              {translate(language, "unone.lab.markers")}
            </h3>
            {report.markers.length === 0 ? (
              <p className="mt-1 text-sm text-[var(--slate-600)]">
                {translate(language, "unone.lab.noMarkers")}
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {report.markers.map((marker) => (
                  <li
                    key={`${marker.normalized_marker}-${marker.source_text ?? ""}`}
                    className="rounded-2xl border border-[var(--border-soft)] bg-white p-3 text-sm"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[var(--slate-900)]">
                        {marker.marker_name}
                      </span>
                      <SeverityBadge severity={marker.severity} />
                    </div>
                    <p className="mt-1 text-[var(--slate-700)]">
                      {marker.value ?? "—"} {marker.unit ?? ""}{" "}
                      {marker.reference_range ? `(ref ${marker.reference_range})` : ""}
                    </p>
                    <p className="mt-1 text-xs text-[var(--slate-600)]">{marker.explanation}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-2xl bg-[var(--surface-muted)] p-4">
            <h3 className="text-sm font-bold text-[var(--slate-950)]">
              {translate(language, "unone.lab.summary")}
            </h3>
            <p className="mt-1 text-sm text-[var(--slate-700)]">{report.overall_summary}</p>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const styles: Record<string, string> = {
    normal: "bg-emerald-50 text-emerald-700",
    watch: "bg-amber-50 text-amber-700",
    consult_doctor: "bg-orange-50 text-orange-700",
    urgent: "bg-red-50 text-red-700",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${styles[severity] ?? styles.normal}`}>
      {severity}
    </span>
  );
}