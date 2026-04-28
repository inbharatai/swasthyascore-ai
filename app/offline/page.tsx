"use client";

import { useState } from "react";
import { translate, type Language } from "@/lib/i18n";

export default function OfflinePage() {
  const [language] = useState<Language>(() => {
    if (typeof window === "undefined") {
      return "en";
    }

    const saved = window.localStorage.getItem("swasthya-score-language");
    return saved === "hi" ? "hi" : "en";
  });

  return (
    <main className="mx-auto flex min-h-screen max-w-xl items-center justify-center px-4">
      <section className="rounded-[32px] border border-[var(--border-soft)] bg-white/95 p-8 text-center shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--brand-700)]">
          {translate(language, "offline.title")}
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--slate-950)]">
          {translate(language, "app.name")}
        </h1>
        <p className="mt-4 text-sm leading-6 text-[var(--slate-600)]">
          {translate(language, "offline.description")}
        </p>
      </section>
    </main>
  );
}
