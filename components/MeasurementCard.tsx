interface MeasurementCardProps {
  title: string;
  value: string;
  subtitle: string;
  note?: string;
  tone?: "neutral" | "low" | "moderate" | "high" | "urgent";
}

const toneClasses: Record<NonNullable<MeasurementCardProps["tone"]>, string> = {
  neutral: "border-[var(--border-soft)] bg-white/90",
  low: "border-emerald-200 bg-emerald-50",
  moderate: "border-amber-200 bg-amber-50",
  high: "border-orange-200 bg-orange-50",
  urgent: "border-rose-200 bg-rose-50",
};

export function MeasurementCard({
  title,
  value,
  subtitle,
  note,
  tone = "neutral",
}: MeasurementCardProps) {
  return (
    <article className={`rounded-[28px] border p-5 shadow-sm ${toneClasses[tone]}`}>
      <p className="text-sm font-semibold text-[var(--slate-600)]">{title}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-[var(--slate-950)]">
        {value}
      </p>
      <p className="mt-2 text-sm text-[var(--slate-800)]">{subtitle}</p>
      {note ? <p className="mt-3 text-xs leading-5 text-[var(--slate-600)]">{note}</p> : null}
    </article>
  );
}
