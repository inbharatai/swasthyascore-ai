"use client";

import { LogOut, UserRound } from "lucide-react";
import { clearLocalSession } from "@/lib/auth/localAuth";
import type { Language } from "@/lib/i18n";
import { translate } from "@/lib/i18n";
import type { LocalAuthSession } from "@/lib/auth/localAuth";

interface UserProfileMenuProps {
  language: Language;
  session: LocalAuthSession;
}

export function UserProfileMenu({ language, session }: UserProfileMenuProps) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-white/70 bg-white/85 p-1 shadow-sm">
      <div className="flex items-center gap-2 pl-3 pr-2">
        <span className="rounded-full bg-[var(--surface-muted)] p-2 text-[var(--brand-700)]">
          <UserRound className="h-4 w-4" />
        </span>
        <span className="hidden text-left sm:block">
          <span className="block max-w-32 truncate text-xs font-bold text-[var(--slate-950)]">
            {session.displayName}
          </span>
          <span className="block text-[10px] font-semibold text-[var(--slate-500)]">
            {translate(
              language,
              `role.${session.role}` as
                | "role.patient"
                | "role.field_worker"
                | "role.clinic_admin"
                | "role.doctor",
            )}
          </span>
        </span>
      </div>
      <button
        type="button"
        onClick={clearLocalSession}
        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-white px-3 text-xs font-bold text-[var(--slate-700)] shadow-sm transition hover:bg-rose-50 hover:text-rose-700"
        aria-label={translate(language, "auth.signOut")}
      >
        <LogOut className="h-4 w-4" />
        <span className="hidden sm:inline">{translate(language, "auth.signOut")}</span>
      </button>
    </div>
  );
}
