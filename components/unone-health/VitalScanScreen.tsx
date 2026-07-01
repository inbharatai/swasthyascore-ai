"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import { Camera, RefreshCw, SwitchCamera, HeartPulse } from "lucide-react";
import {
  getFriendlyCameraErrorKey,
  isCameraSupported,
  requestCameraStream,
  stopCameraStream,
} from "@/lib/camera/camera";
import {
  aggregateFrameSamples,
  cameraFacingToMode,
  cameraScanReducer,
  finalizeVitalScan,
  initialCameraScanState,
  isoNow,
  synthesizeMockFrame,
  type CameraFacing,
  type CameraScanState,
  type RppgFrameSample,
  type VitalScanResult,
} from "@/lib/unone-health";
import type { Language } from "@/lib/i18n";
import { translate } from "@/lib/i18n";
import { getSwasthyakAdapter } from "@/modules/unone-health/adapters/swasthyak-adapter/SwasthyakAdapter";

const ENGINE =
  (process.env.NEXT_PUBLIC_UNONE_RPPG_ENGINE ?? "mock") === "real"
    ? "real"
    : "mock";
// `finalizeVitalScan` expects the engine id ("mock" | "signal"), not the UI
// selector ("real" | "mock"). Map here so the two stay decoupled.
const ENGINE_ID: "mock" | "signal" = ENGINE === "real" ? "signal" : "mock";
const DURATION_SECONDS = 20;

interface VitalScanScreenProps {
  language: Language;
  online: boolean;
  patientId: string;
  onResult: (result: VitalScanResult) => void;
}

export function VitalScanScreen({
  language,
  online,
  patientId,
  onResult,
}: VitalScanScreenProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const framesRef = useRef<RppgFrameSample[]>([]);
  const startRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);
  const providerRef = useRef<{ sample: () => RppgFrameSample | null; release: () => void } | null>(null);
  const [state, dispatch] = useReducer(cameraScanReducer, initialCameraScanState);

  const stopCamera = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    stopCameraStream(streamRef.current);
    streamRef.current = null;
    providerRef.current?.release();
    providerRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const startStream = useCallback(
    async (facing: CameraFacing) => {
      if (!isCameraSupported()) {
        dispatch({ type: "camera_unavailable" });
        return;
      }
      dispatch({ type: facing === state.facing ? "request_permission" : "switch_camera" });
      try {
        const stream = await requestCameraStream({ facingMode: facing });
        stopCameraStream(streamRef.current);
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch (error) {
        dispatch({ type: "permission_denied" });
        void getFriendlyCameraErrorKey(error);
      }
    },
    [state.facing],
  );

  const completeScan = useCallback(() => {
    const samples = aggregateFrameSamples(framesRef.current);
    const cameraMode = cameraFacingToMode(state.facing, false);
    const result = finalizeVitalScan(
      samples,
      { cameraMode, durationSeconds: DURATION_SECONDS },
      ENGINE_ID,
      isoNow(),
    );
    dispatch({ type: "scan_complete", result });
    onResult(result);

    if (online) {
      getSwasthyakAdapter()
        .submitVitalScan(result, patientId)
        .then(() => dispatch({ type: "synced" }))
        .catch(() => dispatch({ type: "save_offline" }));
    } else {
      dispatch({ type: "save_offline" });
    }
  }, [state.facing, onResult, online, patientId]);

  const runLoop = useCallback(() => {
    framesRef.current = [];
    startRef.current = performance.now();
    dispatch({ type: "start_scan" });

    const ensureProvider = async () => {
      if (ENGINE === "real" && !providerRef.current && videoRef.current) {
        const mod = await import(
          "@/modules/unone-health/health-skills/rppg-vital-scan/browserRppg"
        );
        providerRef.current = new mod.FaceRoiFrameProvider(videoRef.current);
        await providerRef.current.sample(); // warm up landmarker
      }
    };

    void ensureProvider().then(() => {
      const tick = () => {
        const elapsed = (performance.now() - startRef.current) / 1000;
        const fraction = Math.min(1, elapsed / DURATION_SECONDS);

        let sample: RppgFrameSample | null = null;
        if (ENGINE === "real") {
          sample = providerRef.current?.sample() ?? null;
          if (!sample) dispatch({ type: "no_face" });
        } else {
          sample = synthesizeMockFrame(elapsed, 72);
        }
        if (sample) framesRef.current.push(sample);

        dispatch({ type: "progress", fraction });

        if (elapsed >= DURATION_SECONDS) {
          completeScan();
          return;
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    });
  }, [completeScan]);

  async function handleSwitch() {
    stopCamera();
    const next: CameraFacing = state.facing === "user" ? "environment" : "user";
    dispatch({ type: "switch_camera" });
    // small delay so the reducer-facing updates before re-requesting
    await startStream(next);
  }

  return (
    <section className="space-y-4 rounded-[30px] border border-white/70 bg-white/95 p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[var(--slate-950)]">
            {translate(language, "unone.section.scan")}
          </h2>
          <p className="mt-1 text-xs leading-5 text-[var(--slate-600)]">
            {state.facing === "user"
              ? translate(language, "unone.scan.front")
              : translate(language, "unone.scan.rear")}
            {" · "}
            {ENGINE === "real"
              ? translate(language, "unone.scan.engine.real")
              : translate(language, "unone.scan.engine.mock")}
          </p>
        </div>
        <span className="rounded-full bg-[var(--surface-muted)] px-3 py-1 text-[11px] font-bold text-[var(--brand-700)]">
          {ENGINE === "mock"
            ? translate(language, "unone.scan.mockNote")
            : translate(language, "unone.scan.experimental")}
        </span>
      </div>

      {!state.consentGiven ? (
        <label className="flex items-start gap-3 rounded-[22px] bg-[var(--surface-muted)] p-4 text-sm text-[var(--slate-800)]">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4"
            onChange={(e) =>
              dispatch({ type: e.target.checked ? "grant_consent" : "revoke_consent" })
            }
          />
          <span>{translate(language, "unone.consentCamera")}</span>
        </label>
      ) : null}

      <div className="relative overflow-hidden rounded-[26px] bg-slate-950">
        <video
          ref={videoRef}
          playsInline
          muted
          className={`h-auto w-full ${state.facing === "user" ? "-scale-x-100" : ""}`}
        />
        {!state.consentGiven ? null : state.status === "scanning" ? (
          <div className="absolute inset-x-0 bottom-0 p-3">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/30">
              <div
                className="h-full bg-emerald-400 transition-all"
                style={{ width: `${Math.round(state.progress * 100)}%` }}
              />
            </div>
            <p className="mt-2 text-center text-xs font-bold text-white">
              {translate(language, "unone.scan.scanning")}{" "}
              {Math.round(state.progress * DURATION_SECONDS)}s / {DURATION_SECONDS}s
            </p>
          </div>
        ) : null}
      </div>

      {state.status === "permission_denied" ? (
        <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800">
          {translate(language, "unone.scan.permissionDenied")}
        </p>
      ) : null}
      {state.status === "camera_unavailable" ? (
        <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {translate(language, "unone.scan.unavailable")}
        </p>
      ) : null}
      {state.status === "no_face" ? (
        <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {translate(language, "unone.scan.noFace")}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={!state.consentGiven}
          onClick={() => startStream(state.facing).then(runLoop)}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--brand-700)] px-5 py-3 text-sm font-bold text-white shadow-sm disabled:opacity-50"
        >
          <Camera className="h-4 w-4" />
          {translate(language, "unone.scan.start")}
        </button>
        <button
          type="button"
          onClick={handleSwitch}
          className="inline-flex items-center justify-center gap-2 rounded-full border border-[var(--border-soft)] bg-white px-5 py-3 text-sm font-bold text-[var(--slate-800)] shadow-sm"
        >
          <SwitchCamera className="h-4 w-4" />
          {translate(language, "unone.scan.switch")}
        </button>
      </div>

      {state.result ? <VitalResultCard language={language} state={state} onRepeat={() => dispatch({ type: "reset" })} /> : null}
    </section>
  );
}

function VitalResultCard({
  language,
  state,
  onRepeat,
}: {
  language: Language;
  state: CameraScanState;
  onRepeat: () => void;
}) {
  const result = state.result!;
  const label =
    result.confidence_label === "good"
      ? "unone.scan.success"
      : result.confidence_label === "low"
        ? "unone.scan.lowConfidence"
        : result.confidence_label === "fail"
          ? "unone.scan.failed"
          : "unone.scan.success";
  return (
    <div className="space-y-3 rounded-[26px] border border-[var(--border-soft)] bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-[var(--slate-950)]">
          {translate(language, label)}
        </p>
        <span className="rounded-full bg-[var(--surface-muted)] px-3 py-1 text-xs font-bold text-[var(--brand-700)]">
          {translate(language, "unone.scan.confidence")}: {Math.round(result.confidence * 100)}%
        </span>
      </div>
      {result.heart_rate_bpm != null ? (
        <div className="flex items-center gap-3 rounded-2xl bg-emerald-50 px-4 py-3">
          <HeartPulse className="h-5 w-5 text-emerald-700" />
          <span className="text-sm font-semibold text-emerald-900">
            {translate(language, "unone.scan.hr")}: {result.heart_rate_bpm} bpm
          </span>
        </div>
      ) : null}
      {result.respiratory_rate_bpm != null ? (
        <div className="rounded-2xl bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-900">
          {translate(language, "unone.scan.rr")}: {result.respiratory_rate_bpm} /min
        </div>
      ) : null}
      {result.repeat_scan_recommended ? (
        <button
          type="button"
          onClick={onRepeat}
          className="inline-flex items-center gap-2 rounded-full bg-amber-600 px-5 py-3 text-sm font-bold text-white"
        >
          <RefreshCw className="h-4 w-4" />
          {translate(language, "unone.scan.repeat")}
        </button>
      ) : null}
      {state.status === "offline_saved" ? (
        <p className="text-xs text-amber-700">{translate(language, "unone.scan.offlineSaved")}</p>
      ) : state.status === "synced" ? (
        <p className="text-xs text-emerald-700">{translate(language, "unone.scan.synced")}</p>
      ) : null}
    </div>
  );
}