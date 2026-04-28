"use client";

import { PlayCircle, StopCircle, Video } from "lucide-react";
import type { RefObject } from "react";
import type { Language } from "@/lib/i18n";
import { translate } from "@/lib/i18n";
import { PoseGuideOverlay } from "./PoseGuideOverlay";

interface CameraCaptureProps {
  language: Language;
  videoRef: RefObject<HTMLVideoElement | null>;
  active: boolean;
  error: string | null;
  onStart: () => void;
  onStop: () => void;
}

export function CameraCapture({
  language,
  videoRef,
  active,
  error,
  onStart,
  onStop,
}: CameraCaptureProps) {
  return (
    <section className="rounded-[34px] border border-white/70 bg-slate-950 p-3 text-white shadow-[0_24px_70px_rgba(15,23,42,0.16)]">
      <div className="relative aspect-[3/4] overflow-hidden rounded-[30px] bg-slate-900 sm:aspect-video">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`h-full w-full object-cover ${active ? "opacity-100" : "opacity-30"}`}
        />
        {active ? (
          <PoseGuideOverlay language={language} />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
            <span className="rounded-full bg-white/10 p-5">
              <Video className="h-9 w-9" />
            </span>
            <h2 className="mt-5 text-2xl font-semibold">
              {translate(language, "camera.previewTitle")}
            </h2>
            <p className="mt-2 max-w-sm text-sm leading-6 text-white/75">
              {translate(language, "camera.previewDescription")}
            </p>
          </div>
        )}
      </div>

      {error ? (
        <p className="mt-3 rounded-2xl bg-rose-500/15 px-4 py-3 text-sm text-rose-100">
          {error}
        </p>
      ) : null}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onStart}
          disabled={active}
          className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-white px-4 text-sm font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-45"
        >
          <PlayCircle className="h-4 w-4" />
          {translate(language, "camera.start")}
        </button>
        <button
          type="button"
          onClick={onStop}
          disabled={!active}
          className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-white/10 px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-45"
        >
          <StopCircle className="h-4 w-4" />
          {translate(language, "camera.stop")}
        </button>
      </div>
    </section>
  );
}
