import { Camera, FileText, HeartPulse, Home, ScrollText } from "lucide-react";
import type { Language } from "@/lib/i18n";
import { translate } from "@/lib/i18n";
import type { AppTab } from "@/lib/types/navigation";

interface BottomNavProps {
  language: Language;
  activeTab: AppTab;
  onChange: (tab: AppTab) => void;
}

const items = [
  { value: "home", key: "nav.home", icon: Home },
  { value: "risk", key: "nav.risk", icon: HeartPulse },
  { value: "camera", key: "nav.camera", icon: Camera },
  { value: "lab", key: "nav.lab", icon: FileText },
  { value: "report", key: "nav.report", icon: ScrollText },
] as const;

export function BottomNav({ language, activeTab, onChange }: BottomNavProps) {
  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-4 z-40 px-4">
      <div className="pointer-events-auto mx-auto grid max-w-md grid-cols-5 items-center rounded-full border border-white/70 bg-white/90 p-2 shadow-lg backdrop-blur">
        {items.map(({ value, key, icon: Icon }) => {
          const selected = activeTab === value;
          return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(value)}
            className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-full text-[10px] font-bold transition ${
              selected
                ? "bg-[var(--brand-700)] text-white shadow-sm"
                : "text-[var(--slate-600)] hover:bg-[var(--surface-muted)]"
            }`}
          >
            <Icon className="h-4 w-4" />
            <span>{translate(language, key)}</span>
          </button>
        )})}
      </div>
    </nav>
  );
}
