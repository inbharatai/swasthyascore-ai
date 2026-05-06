"use client";

import { Activity, Eye, Ruler, ScanLine } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  captureFrame,
  enumerateCameraDevices,
  getFriendlyCameraErrorKey,
  requestCameraStream,
  stopCameraStream,
} from "@/lib/camera/camera";
import type { HealthFormChangeHandler } from "@/lib/types/health";
import type { Language } from "@/lib/i18n";
import { translate } from "@/lib/i18n";
import { BodyRiskAssist } from "./BodyRiskAssist";
import { CameraCapture } from "./CameraCapture";
import { HeightAssist } from "./HeightAssist";
import { HeightCaptureScreen } from "./HeightCaptureScreen";
import { VisibleRiskAssist } from "./VisibleRiskAssist";

type CameraMode = "height" | "body" | "waist" | "visible";

interface CameraHealthAssistProps {
  language: Language;
  online: boolean;
  onApplyField: HealthFormChangeHandler;
}

const modes: Array<{
  value: CameraMode;
  titleKey:
    | "camera.mode.height"
    | "camera.mode.body"
    | "camera.mode.waist"
    | "camera.mode.visible";
  icon: typeof Ruler;
}> = [
  { value: "height", titleKey: "camera.mode.height", icon: Ruler },
  { value: "body", titleKey: "camera.mode.body", icon: Activity },
  { value: "waist", titleKey: "camera.mode.waist", icon: ScanLine },
  { value: "visible", titleKey: "camera.mode.visible", icon: Eye },
];

export function CameraHealthAssist({
  language,
  online,
  onApplyField,
}: CameraHealthAssistProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [active, setActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<CameraMode>("height");
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceIndex, setDeviceIndex] = useState(0);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [showHeightCapture, setShowHeightCapture] = useState(false);

  useEffect(() => {
    return () => {
      stopCameraStream(streamRef.current);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (capturedImage?.startsWith("blob:")) {
        URL.revokeObjectURL(capturedImage);
      }
    };
  }, [capturedImage]);

  async function handleStart(deviceId?: string) {
    setLoading(true);
    try {
      const stream = await requestCameraStream({ deviceId });
      stopCameraStream(streamRef.current);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setActive(true);
      setError(null);
      const availableDevices = await enumerateCameraDevices();
      setDevices(availableDevices);
    } catch (caughtError) {
      setError(translate(language, getFriendlyCameraErrorKey(caughtError)));
    } finally {
      setLoading(false);
    }
  }

  function handleStop() {
    stopCameraStream(streamRef.current);
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setActive(false);
  }

  function handleCapture() {
    const video = videoRef.current;
    if (!video) {
      setError(translate(language, "camera.startFirst"));
      return;
    }

    const image = captureFrame(video);
    if (!image) {
      setError(translate(language, "camera.captureFailed"));
      return;
    }

    setCapturedImage(image);
    setError(null);
  }

  async function handleSwitchCamera() {
    if (devices.length <= 1) {
      return;
    }

    const nextIndex = (deviceIndex + 1) % devices.length;
    setDeviceIndex(nextIndex);
    await handleStart(devices[nextIndex]?.deviceId);
  }

  function handleImageUpload(file: File) {
    if (capturedImage?.startsWith("blob:")) {
      URL.revokeObjectURL(capturedImage);
    }

    setCapturedImage(URL.createObjectURL(file));
    setError(null);
  }

  return (
    <section className="space-y-5">
      <div className="rounded-[34px] border border-white/70 bg-[linear-gradient(135deg,#eff6ff,#ecfdf5)] p-5 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--brand-700)]">
          {translate(language, "camera.kicker")}
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--slate-950)]">
          {translate(language, "camera.title")}
        </h1>
        <p className="mt-2 text-sm leading-6 text-[var(--slate-600)]">
          {translate(language, "camera.subtitle")}
        </p>
        <p className="mt-4 rounded-[22px] bg-white/75 px-4 py-3 text-xs leading-5 text-[var(--slate-700)]">
          {translate(language, "camera.privacy")}
        </p>
      </div>

      <CameraCapture
        language={language}
        videoRef={videoRef}
        active={active}
        loading={loading}
        error={error}
        capturedImage={capturedImage}
        canSwitch={devices.length > 1}
        onStart={() => handleStart()}
        onStop={handleStop}
        onCapture={handleCapture}
        onSwitch={handleSwitchCamera}
        onImageUpload={handleImageUpload}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {modes.map(({ value, titleKey, icon: Icon }) => {
          const selected = value === mode;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              className={`rounded-[24px] border p-4 text-left shadow-sm transition ${
                selected
                  ? "border-[var(--brand-700)] bg-[var(--brand-700)] text-white"
                  : "border-white/70 bg-white/95 text-[var(--slate-800)]"
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="mt-3 block text-sm font-bold">
                {translate(language, titleKey)}
              </span>
            </button>
          );
        })}
      </div>

      {mode === "height" ? (
        <>
          <button
            type="button"
            onClick={() => setShowHeightCapture(true)}
            className="w-full rounded-[24px] border border-[var(--brand-700)] bg-[var(--brand-700)] py-3 text-sm font-bold text-white"
          >
            {translate(language, "capture.title")}
          </button>
          <HeightAssist
            language={language}
            videoRef={videoRef}
            onApplyHeight={(value) => onApplyField("heightCm", value)}
          />
          {showHeightCapture ? (
            <HeightCaptureScreen
              language={language}
              onApplyHeight={(value) => {
                onApplyField("heightCm", value);
              }}
              onClose={() => setShowHeightCapture(false)}
            />
          ) : null}
        </>
      ) : null}
      {mode === "body" ? (
        <BodyRiskAssist language={language} videoRef={videoRef} />
      ) : null}
      {mode === "waist" ? (
        <section className="rounded-[30px] border border-white/70 bg-white/95 p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-[var(--slate-950)]">
            {translate(language, "camera.waist.title")}
          </h3>
          <p className="mt-2 text-sm leading-6 text-[var(--slate-600)]">
            {translate(language, "camera.waist.description")}
          </p>
          <div className="mt-5 rounded-[28px] bg-[linear-gradient(135deg,#fef3c7,#ecfeff)] p-5">
            <div className="mx-auto h-40 max-w-xs rounded-[42%] border-4 border-dashed border-amber-600/70 bg-white/55" />
            <p className="mt-4 text-center text-sm font-semibold text-amber-950">
              {translate(language, "camera.waist.visualGuide")}
            </p>
          </div>
          <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
            {translate(language, "camera.waist.finalManual")}
          </p>
        </section>
      ) : null}
      {mode === "visible" ? (
        <VisibleRiskAssist language={language} online={online} />
      ) : null}
    </section>
  );
}
