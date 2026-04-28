import type { Language } from "@/lib/i18n";
import { translate } from "@/lib/i18n";

interface PoseGuideOverlayProps {
  language: Language;
}

export function PoseGuideOverlay({ language }: PoseGuideOverlayProps) {
  return (
    <div className="pointer-events-none absolute inset-0 rounded-[30px]">
      <div className="absolute inset-5 rounded-[28px] border-2 border-dashed border-white/70" />
      <div className="absolute left-1/2 top-8 h-[72%] w-20 -translate-x-1/2 rounded-full border border-white/50" />
      <div className="absolute bottom-4 left-4 right-4 rounded-2xl bg-slate-950/55 px-4 py-3 text-xs font-semibold leading-5 text-white backdrop-blur">
        <p>{translate(language, "camera.guideFullBody")}</p>
        <p className="mt-1 text-white/80">
          {translate(language, "camera.guideReference")}
        </p>
      </div>
    </div>
  );
}
