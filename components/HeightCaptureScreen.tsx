"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X, AlertTriangle, CheckCircle2, Circle, Loader2 } from "lucide-react";
import {
  getFriendlyCameraErrorKey,
  requestCameraStream,
  stopCameraStream,
} from "@/lib/camera/camera";
import { startPoseStream } from "@/lib/camera/poseLandmarks";
import {
  evaluatePoseQuality,
  type PoseQualityResult,
  type PoseWarningKey,
} from "@/lib/camera/poseQualityEngine";
import { captureHeightFrames } from "@/lib/camera/multiFrameCapture";
import {
  detectArucoMarker,
  loadOpenCV,
  type MarkerDetectionResult,
} from "@/lib/camera/markerScaleEngine";
import type { PoseAnalysisResult } from "@/lib/types/camera";
import type { Language, TranslationKey } from "@/lib/i18n";
import { translate } from "@/lib/i18n";
import { HeightCaptureOverlay } from "./HeightCaptureOverlay";

export type CaptureMode = "manual" | "ai" | "marker";

interface CaptureResult {
  estimatedHeightCm: number | null;
  rangeMinCm: number | null;
  rangeMaxCm: number | null;
  confidence: "high" | "medium" | "low";
  framesUsed: number;
  totalFrames: number;
  requiresManualConfirmation: boolean;
  warnings: string[];
}

interface HeightCaptureScreenProps {
  language: Language;
  onApplyHeight: (heightCm: string) => void;
  onClose: () => void;
}

const CAPTURE_DURATION_MS = 3000;
// ArUco DICT_4X4_50 marker 0, real-world side = 180 mm
const MARKER_SIDE_MM = 180;

function ConfidenceBadge({
  confidence,
  language,
}: {
  confidence: "high" | "medium" | "low";
  language: Language;
}) {
  const key =
    confidence === "high"
      ? "capture.confidence.high"
      : confidence === "medium"
        ? "capture.confidence.medium"
        : "capture.confidence.low";
  const color =
    confidence === "high"
      ? "bg-green-100 text-green-800"
      : confidence === "medium"
        ? "bg-amber-100 text-amber-800"
        : "bg-red-100 text-red-800";
  const Icon =
    confidence === "high"
      ? CheckCircle2
      : confidence === "medium"
        ? Circle
        : AlertTriangle;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${color}`}>
      <Icon className="h-3.5 w-3.5" />
      {translate(language, key)}
    </span>
  );
}

export function HeightCaptureScreen({
  language,
  onApplyHeight,
  onClose,
}: HeightCaptureScreenProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stopPoseRef = useRef<(() => void) | null>(null);
  const canvasForMarkerRef = useRef<HTMLCanvasElement>(null);
  const modelTimeoutRef = useRef<number | null>(null);

  const [mode, setMode] = useState<CaptureMode>("ai");
  const [cameraErrorKey, setCameraErrorKey] = useState<TranslationKey | null>(null);
  const [cameraLoading, setCameraLoading] = useState(true);
  const [cameraRetryNonce, setCameraRetryNonce] = useState(0);
  const [videoSize, setVideoSize] = useState({ width: 0, height: 0 });
  const [isOnline, setIsOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );

  const [poseResult, setPoseResult] = useState<PoseAnalysisResult | null>(null);
  const [quality, setQuality] = useState<PoseQualityResult>({
    confidence: "low",
    warnings: [],
    qualityScore: 0,
    headVisible: false,
    heelVisible: false,
    fullBodyVisible: false,
    bodySpanFraction: 0,
  });

  const [markerState, setMarkerState] = useState<
    "idle" | "loading" | "error" | "ready"
  >("idle");
  const [markerResult, setMarkerResult] = useState<MarkerDetectionResult | null>(null);
  const [markerCorners, setMarkerCorners] = useState<[number, number][] | null>(null);

  const [capturing, setCapturing] = useState(false);
  const [captureProgress, setCaptureProgress] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [captureResult, setCaptureResult] = useState<CaptureResult | null>(null);

  const [showSafetyModal, setShowSafetyModal] = useState(false);
  const [mediapipeLoading, setMediapipeLoading] = useState(false);
  const [mediapipeError, setMediapipeError] = useState(false);

  const clearModelTimeout = useCallback(() => {
    if (modelTimeoutRef.current != null) {
      window.clearTimeout(modelTimeoutRef.current);
      modelTimeoutRef.current = null;
    }
  }, []);

  const retryCamera = useCallback(() => {
    setCameraErrorKey(null);
    setMediapipeError(false);
    setCaptureResult(null);
    setCameraRetryNonce((prev) => prev + 1);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  // --- Camera setup ---
  useEffect(() => {
    let mounted = true;

    async function startCamera() {
      setCameraLoading(true);
      try {
        const stream = await requestCameraStream({ facingMode: "environment" });
        if (!mounted) {
          stopCameraStream(stream);
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play();
          setVideoSize({ width: video.videoWidth, height: video.videoHeight });
        }
        setCameraErrorKey(null);
      } catch (error) {
        if (mounted) {
          setCameraErrorKey(getFriendlyCameraErrorKey(error));
        }
      } finally {
        if (mounted) setCameraLoading(false);
      }
    }

    startCamera();

    return () => {
      mounted = false;
      stopCameraStream(streamRef.current);
      streamRef.current = null;
      stopPoseRef.current?.();
      clearModelTimeout();
    };
  }, [cameraRetryNonce, clearModelTimeout]);

  // --- Pose stream (AI + marker modes) ---
  useEffect(() => {
    if (mode === "manual" || cameraLoading || cameraErrorKey) return;

    let stopped = false;
    let stopFn: (() => void) | null = null;

    const startPose = () => {
      setMediapipeLoading(true);
      setMediapipeError(false);
      clearModelTimeout();

      modelTimeoutRef.current = window.setTimeout(() => {
        setMediapipeLoading(false);
        setMediapipeError(true);
      }, 12000);

      const video = videoRef.current;
      if (!video) return;

      stopFn = startPoseStream(video, (result) => {
        if (stopped) return;

        if (result == null) {
          setMediapipeLoading(false);
          setMediapipeError(true);
          clearModelTimeout();
          return;
        }

        setMediapipeError(false);
        setMediapipeLoading(false);
        clearModelTimeout();
        setPoseResult(result);
        const q = evaluatePoseQuality(result, video.videoWidth, video.videoHeight);
        setQuality(q);

        // Marker detection in marker mode
        if (mode === "marker" && markerState === "ready") {
          const canvas = canvasForMarkerRef.current;
          if (canvas) {
            const ctx = canvas.getContext("2d");
            if (ctx) {
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
              ctx.drawImage(video, 0, 0);
              const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const detected = detectArucoMarker(imageData, MARKER_SIDE_MM);
              setMarkerResult(detected);
              setMarkerCorners(detected?.corners ?? null);
            }
          }
        }
      });

      stopPoseRef.current = () => {
        stopped = true;
        stopFn?.();
      };
    };

    startPose();

    return () => {
      stopped = true;
      stopFn?.();
      clearModelTimeout();
    };
  }, [mode, cameraLoading, cameraErrorKey, markerState, clearModelTimeout]);

  // --- Marker mode: load OpenCV ---
  useEffect(() => {
    if (mode !== "marker" || markerState !== "idle") return;

    const initMarkerEngine = () => {
      setMarkerState("loading");
      loadOpenCV()
        .then(() => setMarkerState("ready"))
        .catch(() => setMarkerState("error"));
    };

    initMarkerEngine();
  }, [mode, markerState]);

  // Handle video metadata loaded → update size
  const handleVideoLoaded = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      setVideoSize({ width: video.videoWidth, height: video.videoHeight });
    }
  }, []);

  // --- Countdown + Capture ---
  async function handleStartCapture() {
    if (capturing) return;
    setCaptureResult(null);

    // 3-2-1 countdown
    for (let i = 3; i >= 1; i--) {
      setCountdown(i);
      await new Promise<void>((resolve) => setTimeout(resolve, 1000));
    }
    setCountdown(null);
    setCapturing(true);
    setCaptureProgress(0);

    const video = videoRef.current;
    if (!video) {
      setCapturing(false);
      return;
    }

    const refPx =
      mode === "marker" && markerResult
        ? markerResult.detectedSidePx
        : null;
    const refCm =
      mode === "marker" && markerResult
        ? MARKER_SIDE_MM / 10 // mm → cm
        : null;

    try {
      const result = await captureHeightFrames(
        video,
        CAPTURE_DURATION_MS,
        (pct) => setCaptureProgress(pct),
        refPx,
        refCm,
      );

      // In marker mode, override confidence to high when marker was detected and frames agree
      const finalConfidence =
        mode === "marker" && markerResult?.confidence === "high" && result.confidenceLevel !== "low"
          ? "high"
          : result.confidenceLevel;

      setCaptureResult({
        estimatedHeightCm: result.estimatedHeightCm,
        rangeMinCm: result.rangeMinCm,
        rangeMaxCm: result.rangeMaxCm,
        confidence: finalConfidence,
        framesUsed: result.validFrameCount,
        totalFrames: result.frameCount,
        requiresManualConfirmation: result.requiresManualConfirmation && finalConfidence !== "high",
        warnings: result.warnings,
      });
    } finally {
      setCapturing(false);
      setCaptureProgress(0);
    }
  }

  function handleApplyHeight() {
    if (!captureResult?.estimatedHeightCm) return;

    if (captureResult.confidence === "low") {
      setShowSafetyModal(true);
      return;
    }

    onApplyHeight(String(captureResult.estimatedHeightCm));
    onClose();
  }

  function handleApplyAnyway() {
    if (!captureResult?.estimatedHeightCm) return;
    onApplyHeight(String(captureResult.estimatedHeightCm));
    setShowSafetyModal(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between px-4 py-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-white/60">
            {translate(language, "camera.kicker")}
          </p>
          <h2 className="text-base font-semibold text-white">
            {translate(language, "capture.title")}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
          aria-label={translate(language, "capture.close")}
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Mode selector */}
      <div className="flex shrink-0 gap-2 px-4 pb-3">
        {(["manual", "ai", "marker"] as CaptureMode[]).map((m) => {
          const labelKey =
            m === "manual"
              ? "capture.mode.manual"
              : m === "ai"
                ? "capture.mode.ai"
                : "capture.mode.markerSoon";
          return (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                setCaptureResult(null);
                if (m === "marker" && markerState === "idle") {
                  // will trigger loadOpenCV effect
                }
              }}
              className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                mode === m
                  ? "bg-white text-black"
                  : "bg-white/10 text-white hover:bg-white/20"
              }`}
            >
              {translate(language, labelKey)}
            </button>
          );
        })}
      </div>

      {/* Camera view */}
      <div className="relative min-h-0 flex-1 overflow-hidden bg-black">
        {cameraLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-white/60" />
          </div>
        )}
        {cameraErrorKey && (
          <div className="absolute inset-0 z-20 flex items-center justify-center px-8 text-center">
            <div className="space-y-3 rounded-2xl bg-black/70 p-5">
              <p className="text-sm text-red-300">
                {translate(language, cameraErrorKey ?? "camera.permissionError")}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={retryCamera}
                  className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-black"
                >
                  {translate(language, "capture.retryCamera")}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-white"
                >
                  {translate(language, "capture.manualFallback")}
                </button>
              </div>
            </div>
          </div>
        )}
        <video
          ref={videoRef}
          onLoadedMetadata={handleVideoLoaded}
          playsInline
          muted
          className="h-full w-full object-cover"
        />
        {mode !== "manual" && !cameraErrorKey && (
          <HeightCaptureOverlay
            poseResult={poseResult}
            qualityResult={quality}
            videoWidth={videoSize.width}
            videoHeight={videoSize.height}
            markerCorners={markerCorners}
          />
        )}
        {/* Capture progress bar */}
        {capturing && (
          <div className="absolute inset-x-0 bottom-0 h-1 bg-white/20">
            <div
              className="h-full bg-green-400 transition-all"
              style={{ width: `${captureProgress * 100}%` }}
            />
          </div>
        )}
        {/* Countdown overlay */}
        {countdown != null && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-7xl font-black text-white drop-shadow-lg">
              {countdown}
            </span>
          </div>
        )}
        {/* MediaPipe loading indicator */}
        {mediapipeLoading && mode !== "manual" && (
          <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-full bg-black/70 px-3 py-1.5">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-white/70" />
            <span className="text-xs text-white/70">
              {translate(language, "capture.mediapipeLoading")}
            </span>
          </div>
        )}
        {/* Marker loading/status */}
        {mode === "marker" && (
          <div className="absolute right-3 top-3 rounded-full bg-black/70 px-3 py-1.5 text-xs font-bold">
            {markerState === "loading" ? (
              <span className="flex items-center gap-1.5 text-white/70">
                <Loader2 className="h-3 w-3 animate-spin" />
                {translate(language, "capture.markerLoading")}
              </span>
            ) : markerState === "error" ? (
              <span className="text-red-400">
                {translate(language, "capture.markerLoadError")}
              </span>
            ) : markerResult ? (
              <span className="text-green-400">
                ✓ {translate(language, "capture.markerDetected")}
              </span>
            ) : (
              <span className="text-white/50">
                {translate(language, "capture.markerNotDetected")}
              </span>
            )}
          </div>
        )}
        {/* Hidden canvas for OpenCV frame extraction */}
        <canvas ref={canvasForMarkerRef} className="hidden" />
      </div>

      {/* Quality warnings */}
      {mode !== "manual" && quality.warnings.length > 0 && !cameraErrorKey && (
        <div className="shrink-0 space-y-1 bg-black/80 px-4 py-2">
          {quality.warnings.map((w) => (
            <div key={w} className="flex items-center gap-2 text-xs text-amber-300">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              {translate(language, w as PoseWarningKey)}
            </div>
          ))}
        </div>
      )}

      {/* Confidence badge */}
      {mode !== "manual" && !cameraErrorKey && !mediapipeLoading && (
        <div className="flex shrink-0 items-center gap-3 bg-black/90 px-4 py-2">
          <ConfidenceBadge confidence={quality.confidence} language={language} />
          {mode === "marker" && (
            <a
              href="/printable-marker.html"
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto text-xs text-white/50 underline"
            >
              {translate(language, "capture.markerPrintLink")}
            </a>
          )}
        </div>
      )}

      {/* Capture result card */}
      {captureResult && (
        <div className="shrink-0 bg-black/90 px-4 py-3">
          <div className="rounded-2xl bg-white/10 p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-white/60">
              {translate(language, "capture.result.title")}
            </p>
            {captureResult.estimatedHeightCm != null ? (
              <>
                <p className="mt-1 text-3xl font-black text-white">
                  {captureResult.estimatedHeightCm}{" "}
                  <span className="text-lg font-normal text-white/60">cm</span>
                </p>
                {captureResult.rangeMinCm != null && captureResult.rangeMaxCm != null && (
                  <p className="mt-0.5 text-xs text-white/50">
                    {translate(language, "capture.result.range")
                      .replace("{min}", String(captureResult.rangeMinCm))
                      .replace("{max}", String(captureResult.rangeMaxCm))}
                  </p>
                )}
              </>
            ) : (
              <p className="mt-1 text-sm text-white/70">
                {captureResult.warnings[0] ?? translate(language, "camera.poseFailed")}
              </p>
            )}
            <div className="mt-2 flex items-center gap-2">
              <ConfidenceBadge confidence={captureResult.confidence} language={language} />
              <span className="text-xs text-white/40">
                {translate(language, "capture.result.frames")
                  .replace("{valid}", String(captureResult.framesUsed))
                  .replace("{total}", String(captureResult.totalFrames))}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setCaptureResult(null)}
              className="mt-3 text-xs font-semibold text-white/60 underline"
            >
              {translate(language, "capture.retake")}
            </button>
          </div>
        </div>
      )}

      {/* Bottom actions */}
      <div className="shrink-0 flex flex-col gap-2 bg-black/90 px-4 py-4">
        {captureResult?.estimatedHeightCm != null ? (
          <button
            type="button"
            onClick={handleApplyHeight}
            className="w-full rounded-2xl bg-white py-3 text-sm font-bold text-black"
          >
            {translate(language, "capture.applyHeight")}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleStartCapture}
            disabled={
              capturing ||
              countdown != null ||
              cameraLoading ||
              !!cameraErrorKey ||
              (mode !== "manual" && mediapipeError)
            }
            className="w-full rounded-2xl bg-white py-3 text-sm font-bold text-black disabled:opacity-40"
          >
            {capturing
              ? translate(language, "capture.capturing")
              : countdown != null
                ? translate(language, "capture.countdown").replace(
                    "{count}",
                    String(countdown),
                  )
                : translate(language, "capture.startCapture")}
          </button>
        )}
        {mediapipeError && (
          <div className="space-y-1 text-center">
            <p className="text-xs text-red-400">
              {translate(language, "capture.mediapipeError")}
            </p>
            <p className="text-xs text-white/50">
              {isOnline
                ? translate(language, "capture.requiresInternet")
                : translate(language, "capture.offlineDetected")}
            </p>
            <button
              type="button"
              onClick={retryCamera}
              className="text-xs font-semibold text-white/70 underline"
            >
              {translate(language, "capture.retryModel")}
            </button>
          </div>
        )}
        <p className="text-center text-xs text-white/30">
          {translate(language, "capture.subtitle")}
        </p>
      </div>

      {/* Safety disclaimer modal */}
      {showSafetyModal && (
        <div className="fixed inset-0 z-60 flex items-end justify-center bg-black/80 p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-6 w-6 shrink-0 text-amber-500" />
              <h3 className="text-base font-bold text-slate-900">
                {translate(language, "capture.safetyDisclaimerTitle")}
              </h3>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {translate(language, "capture.safetyDisclaimer")}
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <button
                type="button"
                onClick={handleApplyAnyway}
                className="w-full rounded-2xl bg-amber-500 py-3 text-sm font-bold text-white"
              >
                {translate(language, "capture.safetyApplyAnyway")}
              </button>
              <button
                type="button"
                onClick={() => setShowSafetyModal(false)}
                className="w-full rounded-2xl bg-slate-100 py-3 text-sm font-bold text-slate-700"
              >
                {translate(language, "capture.cancel")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
