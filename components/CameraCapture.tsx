"use client";

import { Camera, Images, PlayCircle, RefreshCcw, StopCircle, UploadCloud, Video } from "lucide-react";
import type { RefObject } from "react";
import type { Language } from "@/lib/i18n";
import { translate } from "@/lib/i18n";
import { PoseGuideOverlay } from "./PoseGuideOverlay";

interface CameraCaptureProps {
  language: Language;
  videoRef: RefObject<HTMLVideoElement | null>;
  active: boolean;
  loading: boolean;
  error: string | null;
  capturedImage: string | null;
  canSwitch: boolean;
  onStart: () => void;
  onStop: () => void;
  onCapture: () => void;
  onSwitch: () => void;
  onImageUpload: (file: File) => void;
}

export function CameraCapture({
  language,
  videoRef,
  active,
  loading,
  error,
  capturedImage,
  canSwitch,
  onStart,
  onStop,
  onCapture,
  onSwitch,
  onImageUpload,
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

      <p className="mt-3 rounded-2xl bg-white/10 px-4 py-3 text-xs leading-5 text-white/75">
        {translate(language, "camera.permissionIntro")}
      </p>

      {error ? (
        <p className="mt-3 rounded-2xl bg-rose-500/15 px-4 py-3 text-sm text-rose-100">
          {error}
        </p>
      ) : null}

      {capturedImage ? (
        <div className="mt-3 rounded-[26px] bg-white/10 p-3">
          <div className="flex items-center gap-2 text-xs font-bold text-white/85">
            <Images className="h-4 w-4" />
            {translate(language, "camera.captureReady")}
          </div>
          {/* Blob/data URLs come from the local camera and cannot be optimized by next/image. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={capturedImage}
            alt={translate(language, "camera.captureReady")}
            className="mt-3 max-h-72 w-full rounded-[20px] object-cover"
          />
        </div>
      ) : null}

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <button
          type="button"
          onClick={onStart}
          disabled={active || loading}
          className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-white px-4 text-sm font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-45"
        >
          <PlayCircle className="h-4 w-4" />
          {translate(language, loading ? "camera.loading" : "camera.start")}
        </button>
        <button
          type="button"
          onClick={onCapture}
          disabled={!active}
          className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-white/10 px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-45"
        >
          <Camera className="h-4 w-4" />
          {translate(language, "camera.capture")}
        </button>
        <button
          type="button"
          onClick={onSwitch}
          disabled={!active || !canSwitch}
          className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-white/10 px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-45"
        >
          <RefreshCcw className="h-4 w-4" />
          {translate(language, "camera.switch")}
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

      <label className="mt-3 flex cursor-pointer items-center justify-between gap-3 rounded-[24px] border border-dashed border-white/25 bg-white/10 px-4 py-3 text-sm font-bold text-white/90">
        <span className="inline-flex items-center gap-2">
          <UploadCloud className="h-4 w-4" />
          {translate(language, "camera.uploadFallback")}
        </span>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              onImageUpload(file);
            }
          }}
        />
      </label>
      <p className="mt-2 px-2 text-xs leading-5 text-white/60">
        {translate(language, "camera.uploadFallbackHelp")}
      </p>
    </section>
  );
}
