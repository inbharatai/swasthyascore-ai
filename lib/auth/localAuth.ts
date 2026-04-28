"use client";

import type { Language } from "@/lib/i18n";
import type { UserRole } from "@/lib/types/health";

export interface LocalAuthSession {
  id: string;
  displayName: string;
  role: UserRole;
  language: Language;
  createdAtIso: string;
  lastActiveIso: string;
  mode: "local_device";
}

export interface CreateLocalSessionInput {
  displayName: string;
  role: UserRole;
  language: Language;
}

const localAuthStorageKey = "swasthya-score-local-auth-session";
const localAuthChangeEvent = "swasthya-score-local-auth-change";

function dispatchAuthChange() {
  window.dispatchEvent(new Event(localAuthChangeEvent));
}

export function getStoredLocalSession(): LocalAuthSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  const stored = window.localStorage.getItem(localAuthStorageKey);
  if (!stored) {
    return null;
  }

  try {
    return JSON.parse(stored) as LocalAuthSession;
  } catch {
    window.localStorage.removeItem(localAuthStorageKey);
    return null;
  }
}

export function getServerLocalSession(): LocalAuthSession | null {
  return null;
}

export function subscribeToLocalSession(onStoreChange: () => void) {
  function handleStorage(event: StorageEvent) {
    if (event.key === localAuthStorageKey) {
      onStoreChange();
    }
  }

  window.addEventListener("storage", handleStorage);
  window.addEventListener(localAuthChangeEvent, onStoreChange);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(localAuthChangeEvent, onStoreChange);
  };
}

export function createLocalSession(
  input: CreateLocalSessionInput,
): LocalAuthSession {
  const nowIso = new Date().toISOString();

  return {
    id:
      globalThis.crypto?.randomUUID?.() ??
      `local-${Math.random().toString(36).slice(2)}`,
    displayName: input.displayName.trim() || "Local user",
    role: input.role,
    language: input.language,
    createdAtIso: nowIso,
    lastActiveIso: nowIso,
    mode: "local_device",
  };
}

export function saveLocalSession(session: LocalAuthSession) {
  window.localStorage.setItem(
    localAuthStorageKey,
    JSON.stringify({
      ...session,
      lastActiveIso: new Date().toISOString(),
    }),
  );
  dispatchAuthChange();
}

export function clearLocalSession() {
  window.localStorage.removeItem(localAuthStorageKey);
  dispatchAuthChange();
}
