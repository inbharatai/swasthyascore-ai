import type { Language } from "@/lib/i18n";
import { translate } from "@/lib/i18n";
import type { RiskLevel } from "@/lib/types/health";

interface RiskGaugeProps {
  language: Language;
  riskLevel: RiskLevel;
}

const riskLabels: Array<{ level: RiskLevel; key: "common.low" | "common.moderate" | "common.high" | "common.urgent"; color: string }> =
  [
    { level: "LOW", key: "common.low", color: "bg-emerald-500" },
    { level: "MODERATE", key: "common.moderate", color: "bg-amber-500" },
    { level: "HIGH", key: "common.high", color: "bg-orange-500" },
    { level: "URGENT", key: "common.urgent", color: "bg-rose-500" },
  ];

export function RiskGauge({ language, riskLevel }: RiskGaugeProps) {
  return (
    <div className="rounded-[28px] border border-[var(--border-soft)] bg-white/95 p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[var(--slate-600)]">
            {translate(language, "overall.title")}
          </p>
          <p className="mt-1 text-xl font-semibold text-[var(--slate-950)]">
            {translate(
              language,
              riskLevel === "LOW"
                ? "overall.low"
                : riskLevel === "MODERATE"
                  ? "overall.moderate"
                  : riskLevel === "HIGH"
                    ? "overall.high"
                    : "overall.urgent",
            )}
          </p>
        </div>
        <span className="rounded-full bg-[var(--surface-muted)] px-3 py-1 text-xs font-semibold text-[var(--slate-700)]">
          {translate(language, "result.manualOnly")}
        </span>
      </div>
      <div className="mt-5 grid grid-cols-4 gap-2">
        {riskLabels.map((item) => {
          const active = item.level === riskLevel;
          return (
            <div
              key={item.level}
              className={`rounded-2xl p-3 text-center text-xs font-semibold transition ${
                active
                  ? `${item.color} text-white shadow-sm`
                  : "bg-[var(--surface-muted)] text-[var(--slate-600)]"
              }`}
            >
              {translate(language, item.key)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
