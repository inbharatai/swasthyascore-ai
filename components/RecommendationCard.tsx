interface RecommendationCardProps {
  title: string;
  items: string[];
  tone?: "soft" | "alert";
}

export function RecommendationCard({
  title,
  items,
  tone = "soft",
}: RecommendationCardProps) {
  return (
    <section
      className={`rounded-[28px] border p-5 shadow-sm ${
        tone === "alert"
          ? "border-rose-200 bg-rose-50"
          : "border-[var(--border-soft)] bg-white/95"
      }`}
    >
      <h3 className="text-lg font-semibold text-[var(--slate-950)]">{title}</h3>
      <ul className="mt-4 space-y-3">
        {items.map((item) => (
          <li
            key={item}
            className="rounded-2xl bg-[var(--surface-muted)] px-4 py-3 text-sm leading-6 text-[var(--slate-800)]"
          >
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}
