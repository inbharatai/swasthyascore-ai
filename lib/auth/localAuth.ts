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
let cachedSessionRaw: string | null | undefined;
let cachedSession: LocalAuthSession | null = null;

function dispatchAuthChange() {
  window.dispatchEvent(new Event(localAuthChangeEvent));
}

export function getStoredLocalSession(): LocalAuthSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  const stored = window.localStorage.getItem(localAuthStorageKey);
  if (stored === cachedSessionRaw) {
    return cachedSession;
  }

  cachedSessionRaw = stored;

  if (!stored) {
    cachedSession = null;
    return null;
  }

  try {
    cachedSession = JSON.parse(stored) as LocalAuthSession;
    return cachedSession;
  } catch {
    window.localStorage.removeItem(localAuthStorageKey);
    cachedSessionRaw = null;
    cachedSession = null;
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
  const nextSession = {
    ...session,
    lastActiveIso: new Date().toISOString(),
  };
  const serialized = JSON.stringify(nextSession);

  cachedSessionRaw = serialized;
  cachedSession = nextSession;
  window.localStorage.setItem(localAuthStorageKey, serialized);
  dispatchAuthChange();
}

export function clearLocalSession() {
  cachedSessionRaw = null;
  cachedSession = null;
  window.localStorage.removeItem(localAuthStorageKey);
  dispatchAuthChange();
}
