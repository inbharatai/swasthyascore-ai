import {
  Camera,
  FileText,
  HeartPulse,
  Home,
  ScanHeart,
  ScrollText,
} from "lucide-react";
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
  { value: "ai", key: "nav.ai", icon: ScanHeart },
] as const;

export function BottomNav({ language, activeTab, onChange }: BottomNavProps) {
  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
      <div className="pointer-events-auto mx-auto grid max-w-md grid-cols-6 items-center rounded-[28px] border border-white/70 bg-white/[0.92] p-1.5 shadow-[0_18px_55px_rgba(15,23,42,0.18)] backdrop-blur-xl">
        {items.map(({ value, key, icon: Icon }) => {
          const selected = activeTab === value;
          return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(value)}
            className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-[22px] text-[10px] font-bold transition ${
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
