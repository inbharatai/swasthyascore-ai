"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import type { Language, TranslationKey } from "@/lib/i18n";
import { translate } from "@/lib/i18n";
import type { HealthEvent } from "@/lib/unone-health";
import { getSwasthyakAdapter } from "@/modules/unone-health/adapters/swasthyak-adapter/SwasthyakAdapter";

interface HealthTimelineProps {
  language: Language;
  patientId: string;
}

export function HealthTimeline({ language, patientId }: HealthTimelineProps) {
  const [events, setEvents] = useState<HealthEvent[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const timeline = await getSwasthyakAdapter().getTimeline(patientId);
      setEvents(timeline);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Defer the async load out of the effect body (matches the repo's
    // established pattern) so we don't trigger a synchronous setState during
    // the effect's initial render pass.
    const handle = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  return (
    <section className="space-y-3 rounded-[30px] border border-white/70 bg-white/95 p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[var(--slate-950)]">
          {translate(language, "unone.timeline.title")}
        </h2>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-2 rounded-full border border-[var(--border-soft)] bg-white px-3 py-2 text-xs font-bold text-[var(--slate-700)]"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          {translate(language, "unone.timeline.refresh")}
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--slate-600)]">
          {translate(language, "unone.timeline.loading")}
        </p>
      ) : events.length === 0 ? (
        <p className="text-sm text-[var(--slate-600)]">
          {translate(language, "unone.timeline.empty")}
        </p>
      ) : (
        <ol className="space-y-2">
          {events.map((event) => (
            <li
              key={event.event_id}
              className="rounded-2xl border border-[var(--border-soft)] bg-white p-3 text-sm"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-[var(--slate-900)]">
                  {translate(
                    language,
                    `unone.timeline.event.${event.event_type}` as TranslationKey,
                  )}
                </span>
                <span className="text-xs text-[var(--slate-600)]">
                  {event.synced_at
                    ? translate(language, "unone.timeline.synced")
                    : translate(language, "unone.timeline.pending")}
                </span>
              </div>
              <p className="mt-1 text-xs text-[var(--slate-600)]">
                {event.source} · {event.created_at}
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}