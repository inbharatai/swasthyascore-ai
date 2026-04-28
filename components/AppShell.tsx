"use client";

import { useCallback, useEffect, useSyncExternalStore, useState } from "react";
import type { Language } from "@/lib/i18n";
import { translate } from "@/lib/i18n";
import type { AppTab } from "@/lib/types/navigation";
import { useClientReady } from "@/lib/utils/clientReady";
import { LanguageToggle } from "./LanguageToggle";
import { HomeDashboard } from "./HomeDashboard";
import { BottomNav } from "./BottomNav";
import { InstallPWAButton } from "./InstallPWAButton";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const languageStorageKey = "swasthya-score-language";
const languageChangeEvent = "swasthya-score-language-change";

function getStoredLanguage(): Language {
  if (typeof window === "undefined") {
    return "en";
  }

  const savedLanguage = window.localStorage.getItem(languageStorageKey);
  return savedLanguage === "hi" ? "hi" : "en";
}

function subscribeToLanguage(onStoreChange: () => void) {
  function handleStorage(event: StorageEvent) {
    if (event.key === languageStorageKey) {
      onStoreChange();
    }
  }

  window.addEventListener("storage", handleStorage);
  window.addEventListener(languageChangeEvent, onStoreChange);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(languageChangeEvent, onStoreChange);
  };
}

function getServerLanguage(): Language {
  return "en";
}

function subscribeToOnlineStatus(onStoreChange: () => void) {
  window.addEventListener("online", onStoreChange);
  window.addEventListener("offline", onStoreChange);

  return () => {
    window.removeEventListener("online", onStoreChange);
    window.removeEventListener("offline", onStoreChange);
  };
}

function getOnlineStatus() {
  return typeof window === "undefined" ? true : window.navigator.onLine;
}

function getStandaloneStatus() {
  if (typeof window === "undefined") {
    return false;
  }

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone ===
      true
  );
}

function getIosHint() {
  if (typeof window === "undefined") {
    return false;
  }

  const isIos = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
  return isIos && !getStandaloneStatus();
}

export function AppShell() {
  const clientReady = useClientReady();
  const [activeTab, setActiveTab] = useState<AppTab>("home");
  const language = useSyncExternalStore(
    subscribeToLanguage,
    getStoredLanguage,
    getServerLanguage,
  );
  const online = useSyncExternalStore(
    subscribeToOnlineStatus,
    getOnlineStatus,
    () => true,
  );
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [installedByEvent, setInstalledByEvent] = useState(false);
  const installed = installedByEvent || (clientReady && getStandaloneStatus());
  const showIosHint = clientReady && getIosHint();

  const setLanguage = useCallback((nextLanguage: Language) => {
    window.localStorage.setItem(languageStorageKey, nextLanguage);
    window.dispatchEvent(new Event(languageChangeEvent));
  }, []);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      if (process.env.NODE_ENV === "production") {
        navigator.serviceWorker.register("/sw.js").catch(() => {
          return undefined;
        });
      } else {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          for (const registration of registrations) {
            registration.unregister();
          }
        });

        if ("caches" in window) {
          window.caches.keys().then((cacheNames) => {
            for (const cacheName of cacheNames) {
              window.caches.delete(cacheName);
            }
          });
        }
      }
    }

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    }

    function handleInstalled() {
      setInstalledByEvent(true);
      setInstallEvent(null);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  useEffect(() => {
    window.localStorage.setItem(languageStorageKey, language);
    document.documentElement.lang = language;
  }, [language]);

  async function handleInstall() {
    if (!installEvent) {
      return;
    }

    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === "accepted") {
      setInstallEvent(null);
    }
  }

  function handleTabChange(tab: AppTab) {
    setActiveTab(tab);
    window.setTimeout(() => {
      document.getElementById("top")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 0);
  }

  return (
    <div className="min-h-screen bg-[var(--app-bg)] pb-24 text-[var(--slate-900)]">
      <div className="sticky top-0 z-30 border-b border-white/60 bg-white/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--brand-700)]">
              {translate(language, "app.name")}
            </p>
            <p className="mt-1 text-sm text-[var(--slate-600)]">
              {translate(language, "app.safety")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <InstallPWAButton
              language={language}
              installAvailable={Boolean(installEvent) && !installed}
              installed={installed}
              showIosHint={showIosHint}
              onInstall={handleInstall}
            />
            <LanguageToggle language={language} onChange={setLanguage} />
          </div>
        </div>
      </div>

      {(installEvent || showIosHint || installed || !online) && (
        <div className="mx-auto mt-4 w-full max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-[28px] border border-[var(--border-soft)] bg-white/95 p-4 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-semibold text-[var(--slate-900)]">
                  {translate(language, installed ? "status.installed" : "status.installTitle")}
                </p>
                <p className="mt-1 text-sm leading-6 text-[var(--slate-600)]">
                  {!online
                    ? translate(language, "status.onlineRequired")
                    : showIosHint
                      ? translate(language, "status.iosInstallHint")
                      : translate(language, "status.installDescription")}
                </p>
              </div>
              {installEvent && !installed ? (
                <button
                  type="button"
                  onClick={handleInstall}
                  className="inline-flex items-center justify-center rounded-full bg-[var(--brand-700)] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--brand-800)]"
                >
                  {translate(language, "status.installButton")}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      )}

      <HomeDashboard
        language={language}
        online={online}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onLanguageChange={setLanguage}
      />
      <BottomNav
        language={language}
        activeTab={activeTab}
        onChange={handleTabChange}
      />
    </div>
  );
}
