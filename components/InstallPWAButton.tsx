"use client";

import { Download, Smartphone } from "lucide-react";
import type { Language } from "@/lib/i18n";
import { translate } from "@/lib/i18n";

interface InstallPWAButtonProps {
  language: Language;
  installAvailable: boolean;
  installed: boolean;
  showIosHint: boolean;
  onInstall: () => void;
}

export function InstallPWAButton({
  language,
  installAvailable,
  installed,
  showIosHint,
  onInstall,
}: InstallPWAButtonProps) {
  if (installed) {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-800">
        <Smartphone className="h-4 w-4" />
        {translate(language, "status.installed")}
      </span>
    );
  }

  if (installAvailable) {
    return (
      <button
        type="button"
        onClick={onInstall}
        className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--brand-700)] px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-[var(--brand-800)]"
      >
        <Download className="h-4 w-4" />
        {translate(language, "status.installButton")}
      </button>
    );
  }

  if (showIosHint) {
    return (
      <span className="inline-flex max-w-[13rem] items-center gap-2 rounded-full bg-sky-50 px-4 py-2 text-xs font-semibold leading-5 text-sky-800">
        <Smartphone className="h-4 w-4 shrink-0" />
        {translate(language, "status.iosInstallHint")}
      </span>
    );
  }

  return null;
}
