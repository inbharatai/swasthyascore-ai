"use client";

import type { Language } from "@/lib/i18n";
import { translate } from "@/lib/i18n";

interface DownloadReportButtonProps {
  language: Language;
  content: string;
}

export function DownloadReportButton({
  language,
  content,
}: DownloadReportButtonProps) {
  function handleDownload() {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const dateCode = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `swasthya-score-report-${dateCode}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      type="button"
      onClick={handleDownload}
      className="inline-flex w-full items-center justify-center rounded-full bg-[var(--brand-700)] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--brand-800)] sm:w-auto"
    >
      {translate(language, "report.download")}
    </button>
  );
}
