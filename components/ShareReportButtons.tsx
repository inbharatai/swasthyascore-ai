"use client";

import { Check, Copy, Download, Mail, MessageCircle, Share2, X } from "lucide-react";
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
  const [sheetOpen, setSheetOpen] = useState(false);
  const [status, setStatus] = useState<ShareStatus>(null);
  const subject = translate(language, "report.emailSubject");

  async function handleNativeShare() {
    setStatus(null);
    const didShare = await shareNative(content, subject);
    if (!didShare) {
      setStatus("nativeUnavailable");
      return;
    }
    setSheetOpen(false);
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
          onClick={() => {
            setStatus(null);
            setSheetOpen(true);
          }}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[var(--slate-950)] px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800"
        >
          <Share2 className="h-4 w-4" />
          {translate(language, "report.openShareSheet")}
        </button>
      </div>

      <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-xs leading-5 text-emerald-800">
        {translate(language, "report.shareSafety")}
      </p>

      {status && !sheetOpen ? (
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

      {sheetOpen ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 px-3"
          role="dialog"
        >
          <button
            type="button"
            aria-label={translate(language, "report.closeShareSheet")}
            className="absolute inset-0 cursor-default"
            onClick={() => setSheetOpen(false)}
          />
          <div className="relative mb-[env(safe-area-inset-bottom)] w-full max-w-md rounded-t-[34px] border border-white/70 bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_-24px_80px_rgba(15,23,42,0.28)]">
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-200" />
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="text-lg font-bold text-[var(--slate-950)]">
                  {translate(language, "report.shareSheetTitle")}
                </h4>
                <p className="mt-1 text-xs leading-5 text-[var(--slate-600)]">
                  {translate(language, "report.shareDescription")}
                </p>
              </div>
              <button
                type="button"
                aria-label={translate(language, "report.closeShareSheet")}
                onClick={() => setSheetOpen(false)}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[var(--slate-700)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  shareViaWhatsApp(content);
                  setSheetOpen(false);
                }}
                className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-[24px] bg-emerald-50 px-3 py-4 text-sm font-bold text-emerald-800 transition hover:bg-emerald-100"
              >
                <MessageCircle className="h-6 w-6" />
                {translate(language, "report.shareWhatsApp")}
              </button>
              <button
                type="button"
                onClick={() => {
                  shareViaEmail(content, subject);
                  setSheetOpen(false);
                }}
                className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-[24px] bg-sky-50 px-3 py-4 text-sm font-bold text-sky-800 transition hover:bg-sky-100"
              >
                <Mail className="h-6 w-6" />
                {translate(language, "report.shareEmail")}
              </button>
              <button
                type="button"
                onClick={handleCopy}
                className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-[24px] bg-blue-50 px-3 py-4 text-sm font-bold text-blue-800 transition hover:bg-blue-100"
              >
                {status === "copied" ? (
                  <Check className="h-6 w-6 text-emerald-600" />
                ) : (
                  <Copy className="h-6 w-6" />
                )}
                {translate(language, "report.copy")}
              </button>
              <button
                type="button"
                onClick={handleNativeShare}
                className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-[24px] bg-slate-100 px-3 py-4 text-sm font-bold text-[var(--slate-800)] transition hover:bg-slate-200"
              >
                <Share2 className="h-6 w-6" />
                {translate(language, "report.shareNative")}
              </button>
            </div>

            <div className="mt-3 grid gap-2">
              <div className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-50 px-4 py-3 text-xs leading-5 text-[var(--slate-700)]">
                <Download className="h-4 w-4 shrink-0" />
                <span>{translate(language, "report.shareSafety")}</span>
              </div>
              {status ? (
                <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-xs leading-5 text-emerald-800">
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
          </div>
        </div>
      ) : null}
    </div>
  );
}
