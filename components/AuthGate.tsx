"use client";

import { LogIn, ShieldCheck } from "lucide-react";
import { useState, useSyncExternalStore, type ReactNode } from "react";
import {
  createLocalSession,
  getServerLocalSession,
  getStoredLocalSession,
  saveLocalSession,
  subscribeToLocalSession,
} from "@/lib/auth/localAuth";
import type { Language } from "@/lib/i18n";
import { translate } from "@/lib/i18n";
import type { UserRole } from "@/lib/types/health";
import { LanguageToggle } from "./LanguageToggle";

interface AuthGateProps {
  language: Language;
  onLanguageChange: (language: Language) => void;
  children: ReactNode;
}

const roleOptions: UserRole[] = [
  "field_worker",
  "patient",
  "clinic_admin",
  "doctor",
];

export function AuthGate({
  language,
  onLanguageChange,
  children,
}: AuthGateProps) {
  const session = useSyncExternalStore(
    subscribeToLocalSession,
    getStoredLocalSession,
    getServerLocalSession,
  );
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<UserRole>("field_worker");

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    saveLocalSession(
      createLocalSession({
        displayName,
        role,
        language,
      }),
    );
  }

  if (session) {
    return children;
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--brand-700)]">
            {translate(language, "app.name")}
          </p>
          <p className="mt-1 text-sm text-[var(--slate-600)]">
            {translate(language, "auth.localMode")}
          </p>
        </div>
        <LanguageToggle language={language} onChange={onLanguageChange} />
      </div>

      <section className="mt-8 grid flex-1 items-center gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="relative overflow-hidden rounded-[42px] border border-white/60 bg-[linear-gradient(140deg,#064e3b_0%,#0f766e_45%,#0369a1_100%)] p-6 text-white shadow-[0_32px_90px_rgba(15,23,42,0.22)] sm:p-8">
          <div className="absolute -right-20 -top-16 h-56 w-56 rounded-full bg-white/15 blur-2xl" />
          <div className="relative">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-xs font-bold">
              <ShieldCheck className="h-4 w-4" />
              {translate(language, "auth.screeningOnly")}
            </span>
            <h1 className="mt-6 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
              {translate(language, "auth.title")}
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-white/85">
              {translate(language, "auth.description")}
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {[
                "auth.point.local",
                "auth.point.noCloud",
                "auth.point.roles",
                "auth.point.futureReady",
              ].map((key) => (
                <p
                  key={key}
                  className="rounded-[24px] bg-white/12 p-4 text-sm font-semibold leading-6 text-white/90 ring-1 ring-white/15"
                >
                  {translate(
                    language,
                    key as
                      | "auth.point.local"
                      | "auth.point.noCloud"
                      | "auth.point.roles"
                      | "auth.point.futureReady",
                  )}
                </p>
              ))}
            </div>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-[36px] border border-white/70 bg-white/95 p-5 shadow-[0_24px_70px_rgba(15,23,42,0.08)] sm:p-6"
        >
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--brand-700)]">
            {translate(language, "auth.signInKicker")}
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--slate-950)]">
            {translate(language, "auth.signInTitle")}
          </h2>
          <p className="mt-2 text-sm leading-6 text-[var(--slate-600)]">
            {translate(language, "auth.signInDescription")}
          </p>

          <label className="mt-6 block">
            <span className="text-sm font-semibold text-[var(--slate-800)]">
              {translate(language, "auth.nameLabel")}
            </span>
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder={translate(language, "auth.namePlaceholder")}
              className="mt-2 h-14 w-full rounded-[22px] border border-[var(--border-soft)] bg-white px-4 text-base font-semibold text-[var(--slate-950)] shadow-sm outline-none transition focus:border-[var(--brand-700)] focus:ring-4 focus:ring-teal-100"
            />
          </label>

          <label className="mt-4 block">
            <span className="text-sm font-semibold text-[var(--slate-800)]">
              {translate(language, "auth.roleLabel")}
            </span>
            <select
              value={role}
              onChange={(event) => setRole(event.target.value as UserRole)}
              className="mt-2 h-14 w-full rounded-[22px] border border-[var(--border-soft)] bg-white px-4 text-base font-semibold text-[var(--slate-950)] shadow-sm outline-none transition focus:border-[var(--brand-700)] focus:ring-4 focus:ring-teal-100"
            >
              {roleOptions.map((option) => (
                <option key={option} value={option}>
                  {translate(
                    language,
                    `role.${option}` as
                      | "role.patient"
                      | "role.field_worker"
                      | "role.clinic_admin"
                      | "role.doctor",
                  )}
                </option>
              ))}
            </select>
          </label>

          <p className="mt-4 rounded-[22px] bg-sky-50 px-4 py-3 text-xs leading-5 text-sky-900">
            {translate(language, "auth.privacyNote")}
          </p>

          <button
            type="submit"
            className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--brand-700)] px-5 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--brand-800)]"
          >
            <LogIn className="h-4 w-4" />
            {translate(language, "auth.continue")}
          </button>
        </form>
      </section>
    </main>
  );
}
