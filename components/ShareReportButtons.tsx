"use client";

import { Check, Copy, Mail, MessageCircle, Share2 } from "lucide-react";
import { useState } from "react";
import type { Language } from "@/lib/i18n";
import { translate } from "@/lib/i18n";
import {
  copyReport,
  shareNative,
  shareViaEmail,
  shareViaWhatsApp,
} from "@/lib/utils/shareReport";
import { DownloadReportButton } from "./DownloadReportButton";

interface ShareReportButtonsProps {
  language: Language;
  content: string;
}

type ShareStatus = "copied" | "copyFailed" | "nativeUnavailable" | null;

export function ShareReportButtons({
  language,
  content,
}: ShareReportButtonsProps) {
  const [status, setStatus] = useState<ShareStatus>(null);
  const subject = translate(language, "report.emailSubject");

  async function handleNativeShare() {
    setStatus(null);
    const didShare = await shareNative(content, subject);
    if (!didShare) {
      setStatus("nativeUnavailable");
    }
  }

  async function handleCopy() {
    setStatus(null);
    const copied = await copyReport(content);
    setStatus(copied ? "copied" : "copyFailed");
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <DownloadReportButton language={language} content={content} />
        <button
          type="button"
          onClick={() => shareViaWhatsApp(content)}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#25D366] px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:brightness-95"
        >
          <MessageCircle className="h-4 w-4" />
          {translate(language, "report.shareWhatsApp")}
        </button>
        <button
          type="button"
          onClick={() => shareViaEmail(content, subject)}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-sky-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-sky-700"
        >
          <Mail className="h-4 w-4" />
          {translate(language, "report.shareEmail")}
        </button>
        <button
          type="button"
          onClick={handleNativeShare}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[var(--slate-950)] px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800"
        >
          <Share2 className="h-4 w-4" />
          {translate(language, "report.shareNative")}
        </button>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-[var(--border-soft)] bg-white px-4 py-3 text-sm font-bold text-[var(--slate-800)] shadow-sm transition hover:bg-slate-50 sm:col-span-2"
        >
          {status === "copied" ? (
            <Check className="h-4 w-4 text-emerald-600" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
          {translate(language, "report.copy")}
        </button>
      </div>

      <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-xs leading-5 text-emerald-800">
        {translate(language, "report.shareSafety")}
      </p>

      {status ? (
        <p className="rounded-2xl bg-slate-50 px-4 py-3 text-xs leading-5 text-[var(--slate-700)]">
          {translate(
            language,
            status === "copied"
              ? "report.copySuccess"
              : status === "copyFailed"
                ? "report.copyFailure"
                : "report.nativeUnavailable",
          )}
        </p>
      ) : null}
    </div>
  );
}
