"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { Camera, FlashlightOff, Flashlight, HeartPulse, RefreshCw, SkipForward, User, Hand } from "lucide-react";
import { motion, AnimatePresence, useMotionValue, useTransform, type MotionValue } from "motion/react";
import {
  getTorchCapability,
  getVideoTrack,
  isCameraSupported,
  requestCameraStream,
  setTorch,
  stopCameraStream,
  getFriendlyCameraErrorKey,
} from "@/lib/camera/camera";
import {
  aggregateFrameSamples,
  cameraFacingToMode,
  cameraScanReducer,
  finalizeVitalScan,
  initialCameraScanState,
  isoNow,
  type CameraFacing,
  type CameraScanState,
  type RppgFrameSample,
  type VitalScanResult,
} from "@/lib/unone-health";
import type { Language } from "@/lib/i18n";
import { translate } from "@/lib/i18n";
import { getSwasthyakAdapter } from "@/modules/unone-health/adapters/swasthyak-adapter/SwasthyakAdapter";
import type {
  FaceRoiFrameProvider,
  FingerFrameProvider,
} from "@/modules/unone-health/health-skills/rppg-vital-scan/browserRppg";
import {
  VitalScanWaveform,
  type VitalScanWaveformHandle,
} from "@/components/unone-health/VitalScanWaveform";

const DURATION_SECONDS = 20;
const COUNTDOWN_SECONDS = 3;
const STABILITY_HOLD_MS = 1000;
const GATE_CEILING_MS = 10000;
const WAVEFORM_WINDOW = 150;
const HINT_NONE = "__none__";

const MODE_KEYS = {
  face: "unone.scan.mode.face",
  finger: "unone.scan.mode.finger",
} as const;
const MODE_DESC_KEYS = {
  face: "unone.scan.mode.face.desc",
  finger: "unone.scan.mode.finger.desc",
} as const;

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
  const videoTrackRef = useRef<MediaStreamTrack | null>(null);
  // `framesRef` is the WAVEFORM buffer (last WAVEFORM_WINDOW samples, trimmed).
  // `captureRef` is the MEASUREMENT buffer — every kept frame for the whole scan,
  // UNTRIMMED. Splitting these is the load-bearing fix for real-world BPM: the old
  // code estimated HR from the trimmed 7.5–15 s tail of a 20 s scan. The full
  // window flows to `aggregateFrameSamples` via `captureRef`.
  const framesRef = useRef<RppgFrameSample[]>([]);
  const captureRef = useRef<RppgFrameSample[]>([]);
  const startRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);
  const providerRef = useRef<FaceRoiFrameProvider | FingerFrameProvider | null>(null);
  const waveformRef = useRef<VitalScanWaveformHandle | null>(null);
  const countdownNumRef = useRef<HTMLSpanElement | null>(null);
  const progressFillRef = useRef<HTMLDivElement | null>(null);
  const progressLabelRef = useRef<HTMLSpanElement | null>(null);
  const faceOvalRef = useRef<SVGEllipseElement | null>(null);
  const stableSinceRef = useRef<number | null>(null);
  const countdownStartRef = useRef<number>(0);
  const skipRef = useRef<boolean>(false);
  const lastHintRef = useRef<string>(HINT_NONE);
  const torchOnRef = useRef<boolean>(false);
  // Timestamp of the last REAL (non-null) frame sample. A null sample is
  // ambiguous — it can be a benign rAF dedup duplicate OR a genuine no-face /
  // not-ready — so the hint logic debounces "no_face" against this clock.
  const lastRealSampleAtRef = useRef<number>(0);
  const [state, dispatch] = useReducer(cameraScanReducer, initialCameraScanState);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  // Live quality meters — motion values updated imperatively each frame (no
  // React re-render at 60fps, so the scan stays buttery smooth).
  const lightingMv = useMotionValue(0.6);
  const motionMv = useMotionValue(0.6);
  const stabilityMv = useMotionValue(0.6);
  const lightingPct = useTransform(lightingMv, (v) => `${Math.round(clamp01(v) * 100)}%`);
  const motionPct = useTransform(motionMv, (v) => `${Math.round(clamp01(v) * 100)}%`);
  const stabilityPct = useTransform(stabilityMv, (v) => `${Math.round(clamp01(v) * 100)}%`);
  const lightingColor = useTransform(lightingMv, (v): string => (v >= 0.5 ? "#34d399" : "#f59e0b"));
  const motionColor = useTransform(motionMv, (v): string => (v >= 0.5 ? "#34d399" : "#f59e0b"));
  const stabilityColor = useTransform(stabilityMv, (v): string => (v >= 0.5 ? "#34d399" : "#f59e0b"));

  const stopCamera = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    // Turn the torch off if WE turned it on (auto or manual), so it does not
    // stay lit after the scan ends. Best-effort — ignore rejection.
    if (torchOnRef.current && videoTrackRef.current) {
      void setTorch(videoTrackRef.current, false).catch(() => {});
    }
    stopCameraStream(streamRef.current);
    streamRef.current = null;
    videoTrackRef.current = null;
    providerRef.current?.release();
    providerRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    torchOnRef.current = false;
    setTorchOn(false);
    waveformRef.current?.clear();
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const startStream = useCallback(async (facing: CameraFacing) => {
    if (!isCameraSupported()) {
      dispatch({ type: "camera_unavailable" });
      return;
    }
    dispatch({ type: "request_permission" });
    try {
      const stream = await requestCameraStream({ facingMode: facing });
      stopCameraStream(streamRef.current);
      streamRef.current = stream;
      videoTrackRef.current = getVideoTrack(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      const supported = getTorchCapability(videoTrackRef.current);
      // Wrap in setTimeout(0) so this never reads as setState-during-effect
      // when startStream is invoked from an effect-derived path.
      window.setTimeout(() => setTorchSupported(supported), 0);
    } catch (error) {
      dispatch({ type: "permission_denied" });
      void getFriendlyCameraErrorKey(error);
      window.setTimeout(() => setTorchSupported(false), 0);
    }
  }, []);

  const completeScan = useCallback(() => {
    // Aggregate from the UNTRIMMED measurement buffer (full 20 s), not the
    // waveform buffer. This restores the advertised capture window.
    const samples = aggregateFrameSamples(captureRef.current);
    const cameraMode = cameraFacingToMode(state.facing, true);
    const result = finalizeVitalScan(
      samples,
      { cameraMode, durationSeconds: DURATION_SECONDS },
      "signal",
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

  const pushHint = useCallback(
    (sample: RppgFrameSample | null) => {
      // A null sample is EITHER a duplicate video frame (rAF outran the camera —
      // benign, ~half of frames on a 60Hz display driving a 30fps camera) OR a
      // genuine no-face / not-ready. They are indistinguishable at the call site,
      // so we debounce against `lastRealSampleAtRef`: a real sample refreshes it,
      // and a null only surfaces "no_face" when no real sample has arrived for
      // 300ms (sustained no-face). Dedup duplicates therefore never flicker the
      // banner. Finger mode has no face to lose, so a null there never announces
      // "no_face" — it keeps the last contact-derived hint.
      if (sample) lastRealSampleAtRef.current = performance.now();

      // Finger-mode contact hints are derived from the per-frame channel means
      // (real, not dummies): ambient leak (red<200), saturation/over-press
      // (red>254), weak pulse (low pulsatility carried in leftRightConsistency).
      if (sample && state.facing === "environment") {
        const red = sample.redMean ?? 0;
        const pulsatility = sample.leftRightConsistency ?? 0;
        let hint:
          | "finger_cover_camera"
          | "finger_press_lighter"
          | "finger_warm_hands"
          | "quality_ok";
        if (red < 200) hint = "finger_cover_camera";
        else if (red > 254) hint = "finger_press_lighter";
        else if (pulsatility < 0.15) hint = "finger_warm_hands";
        else hint = "quality_ok";
        if (lastHintRef.current === hint) return;
        lastHintRef.current = hint;
        dispatch({ type: hint });
        return;
      }

      if (!sample) {
        // Finger mode: a null is a dedup / not-ready — there is no face, so
        // never announce "no_face"; keep the last contact-derived hint.
        if (state.facing === "environment") return;
        // Face mode: only announce "no_face" when nulls are sustained (>300ms
        // with no real sample), so dedup duplicates don't flicker the banner.
        if (performance.now() - lastRealSampleAtRef.current <= 300) return;
        if (lastHintRef.current === "no_face") return;
        lastHintRef.current = "no_face";
        dispatch({ type: "no_face" });
        return;
      }

      let hint: "low_light" | "motion" | "quality_ok";
      if (sample.lightingScore < 0.5) hint = "low_light";
      else if (sample.motionScore < 0.5) hint = "motion";
      else hint = "quality_ok";
      if (lastHintRef.current === hint) return;
      lastHintRef.current = hint;
      dispatch({ type: hint });
    },
    [state.facing],
  );

  const isStableFrame = useCallback(
    (sample: RppgFrameSample | null): boolean => {
      if (!sample) return false;
      // Finger: the lighting score is the honest contact-quality score (low on
      // ambient leak / saturation / weak pulse); 0.4 = "good enough contact to
      // start". Face: still needs a stable, well-detected face.
      return state.facing === "environment"
        ? sample.lightingScore > 0.4
        : sample.faceStability > 0.8;
    },
    [state.facing],
  );

  const drawLive = useCallback((sample: RppgFrameSample | null) => {
    if (sample) {
      // Measurement buffer: every kept frame, never trimmed.
      captureRef.current.push(sample);
      // Waveform buffer: trimmed to the last WAVEFORM_WINDOW*3 for display only.
      framesRef.current.push(sample);
      if (framesRef.current.length > WAVEFORM_WINDOW * 3) {
        framesRef.current.splice(0, framesRef.current.length - WAVEFORM_WINDOW * 3);
      }
      waveformRef.current?.draw(
        framesRef.current.slice(-WAVEFORM_WINDOW).map((f) => f.greenMean),
      );
      lightingMv.set(sample.lightingScore);
      motionMv.set(sample.motionScore);
      stabilityMv.set(sample.faceStability);
      if (faceOvalRef.current) {
        const stable = state.facing === "environment" ? sample.lightingScore > 0.4 : sample.faceStability > 0.8;
        faceOvalRef.current.style.stroke = stable ? "#34d399" : "rgba(255,255,255,0.6)";
        faceOvalRef.current.style.strokeDasharray = stable ? "0" : "6 7";
      }
    } else {
      waveformRef.current?.draw(
        framesRef.current.slice(-WAVEFORM_WINDOW).map((f) => f.greenMean),
      );
    }
    pushHint(sample);
  }, [lightingMv, motionMv, stabilityMv, pushHint, state.facing]);

  // Pre-scan "get ready" countdown + stability gate. Resolves once the user
  // has held still for ~1s (so the 20s window isn't polluted by settling),
  // rejects with "stability_timeout" after the 10s ceiling.
  const runGate = useCallback((): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
      countdownStartRef.current = performance.now();
      stableSinceRef.current = null;
      skipRef.current = false;
      lastHintRef.current = HINT_NONE;

      const gateTick = () => {
        const now = performance.now();
        const elapsed = now - countdownStartRef.current;

        const remainingSec = Math.max(0, COUNTDOWN_SECONDS - Math.floor(elapsed / 1000));
        if (countdownNumRef.current) {
          countdownNumRef.current.textContent = skipRef.current
            ? ""
            : remainingSec > 0
              ? String(remainingSec)
              : "Go";
        }

        const sample = providerRef.current?.sample() ?? null;
        drawLive(sample);

        if (isStableFrame(sample)) {
          if (stableSinceRef.current === null) stableSinceRef.current = now;
        } else {
          stableSinceRef.current = null;
        }

        const countdownDone = skipRef.current || elapsed >= COUNTDOWN_SECONDS * 1000;
        const stableFor = stableSinceRef.current === null ? 0 : now - stableSinceRef.current;

        if (countdownDone && stableFor >= STABILITY_HOLD_MS) {
          resolve();
          return;
        }
        if (elapsed > GATE_CEILING_MS) {
          reject(new Error("stability_timeout"));
          return;
        }
        rafRef.current = requestAnimationFrame(gateTick);
      };
      rafRef.current = requestAnimationFrame(gateTick);
    });
  }, [drawLive, isStableFrame]);

  const runLoop = useCallback(() => {
    // Release any previous provider before creating a fresh one.
    providerRef.current?.release();
    providerRef.current = null;
    framesRef.current = [];
    captureRef.current = [];
    waveformRef.current?.clear();

    const ensureProvider = async () => {
      if (!videoRef.current) return;
      const mod = await import(
        "@/modules/unone-health/health-skills/rppg-vital-scan/browserRppg"
      );
      // Front camera = face rPPG (HR + RR); rear camera = fingertip rPPG (HR only).
      providerRef.current =
        state.facing === "environment"
          ? new mod.FingerFrameProvider(videoRef.current)
          : new mod.FaceRoiFrameProvider(videoRef.current);
      const provider = providerRef.current;
      if (provider && "ensureLandmarker" in provider) {
        await provider.ensureLandmarker(); // warm up the MediaPipe model
      }
      // Finger mode: auto-enable the torch (a fingertip-over-lens PPG needs the
      // flood-lit red channel; manual torch is easy to forget and gives a dark,
      // non-pulsatile frame → null HR). Best-effort; manual toggle still works.
      if (state.facing === "environment" && videoTrackRef.current && !torchOnRef.current) {
        const ok = await setTorch(videoTrackRef.current, true);
        if (ok) {
          torchOnRef.current = true;
          window.setTimeout(() => setTorchOn(true), 0);
        }
      }
    };

    void ensureProvider()
      .then(async () => {
        dispatch({ type: "begin_countdown" });
        await runGate(); // 3-2-1 + stability hold
        // Discard gate warmup frames; the 20s measurement starts fresh. The first
        // ~1.5 s of measurement frames are also skipped downstream by the HR
        // estimator's warmup trim (contact-stabilisation for finger).
        framesRef.current = [];
        captureRef.current = [];
        stableSinceRef.current = null;
        lastHintRef.current = HINT_NONE;
        dispatch({ type: "start_scan" });
        startRef.current = performance.now();

        const tick = () => {
          const now = performance.now();
          const elapsed = (now - startRef.current) / 1000;
          const fraction = Math.min(1, elapsed / DURATION_SECONDS);

          if (progressFillRef.current) {
            progressFillRef.current.style.width = `${Math.round(fraction * 100)}%`;
          }
          if (progressLabelRef.current) {
            progressLabelRef.current.textContent = `${Math.round(elapsed)}s / ${DURATION_SECONDS}s`;
          }

          const sample = providerRef.current?.sample() ?? null;
          drawLive(sample);

          if (elapsed >= DURATION_SECONDS) {
            completeScan();
            return;
          }
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      })
      .catch((err: unknown) => {
        const reason = err instanceof Error ? err.message : "";
        if (reason === "stability_timeout") {
          dispatch({ type: "stability_timeout" });
        } else {
          dispatch({ type: "scan_failed", error: "model_load_failed" });
        }
      });
  }, [completeScan, drawLive, runGate, state.facing]);

  const selectMode = useCallback(
    (mode: "face" | "finger") => {
      const desired: CameraFacing = mode === "finger" ? "environment" : "user";
      if (desired === state.facing) return;
      const wasStreaming = !!streamRef.current;
      stopCamera();
      dispatch({ type: "switch_camera" });
      if (wasStreaming) void startStream(desired);
    },
    [state.facing, startStream, stopCamera],
  );

  const handleSkip = useCallback(() => {
    skipRef.current = true;
  }, []);

  const toggleTorch = useCallback(async () => {
    const on = !torchOnRef.current;
    // Apply the hardware constraint first; only mirror its real result into the
    // UI state. The old code set the UI optimistically and ignored the return
    // value, so a rejected constraint left the button showing the wrong state
    // (and could re-light the torch on the next finger scan via the
    // `!torchOnRef.current` auto-enable check).
    const ok = await setTorch(videoTrackRef.current, on);
    if (!ok) return;
    torchOnRef.current = on;
    window.setTimeout(() => setTorchOn(on), 0);
  }, []);

  const handleStart = useCallback(() => {
    void startStream(state.facing).then(() => runLoop());
  }, [startStream, state.facing, runLoop]);

  const active = state.status === "countdown" || state.status === "scanning";

  return (
    <section className="space-y-4 rounded-[30px] border border-white/70 bg-white/95 p-5 shadow-sm">
      {/* Header — clearly says "Heart beat scan" */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-[var(--slate-950)]">
            <HeartPulse className="h-5 w-5 text-rose-600" />
            {translate(language, "unone.scan.heartBeatScan")}
          </h2>
          <p className="mt-1 text-xs leading-5 text-[var(--slate-600)]">
            {state.facing === "user"
              ? translate(language, "unone.scan.front")
              : translate(language, "unone.scan.rear")}
          </p>
        </div>
        <span className="rounded-full bg-[var(--surface-muted)] px-3 py-1 text-[11px] font-bold text-[var(--brand-700)]">
          {translate(language, "unone.scan.experimental")}
        </span>
      </div>

      {/* Face / Finger segmented mode toggle */}
      <div className="grid grid-cols-2 gap-2 rounded-2xl bg-[var(--surface-muted)] p-1">
        {(["face", "finger"] as const).map((mode) => {
          const activeMode =
            mode === "face" ? state.facing === "user" : state.facing === "environment";
          return (
            <button
              key={mode}
              type="button"
              onClick={() => selectMode(mode)}
              className={`flex items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-bold transition ${
                activeMode
                  ? "bg-white text-[var(--brand-700)] shadow-sm"
                  : "text-[var(--slate-600)]"
              }`}
            >
              {mode === "face" ? (
                <User className="h-4 w-4 shrink-0" />
              ) : (
                <Hand className="h-4 w-4 shrink-0" />
              )}
              <span>
                <span className="block">
                  {translate(language, MODE_KEYS[mode])}
                </span>
                <span className="block text-[10px] font-medium text-[var(--slate-500)]">
                  {translate(language, MODE_DESC_KEYS[mode])}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Consent */}
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

      {/* Camera viewport */}
      <div className="relative overflow-hidden rounded-[26px] bg-slate-950">
        <video
          ref={videoRef}
          playsInline
          muted
          className={`h-auto w-full ${state.facing === "user" ? "-scale-x-100" : ""}`}
        />

        {/* Face oval guide (front camera) */}
        {state.facing === "user" ? (
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            <ellipse
              ref={faceOvalRef}
              cx="50"
              cy="48"
              rx="26"
              ry="34"
              fill="none"
              stroke="rgba(255,255,255,0.6)"
              strokeWidth="0.6"
              strokeDasharray="6 7"
              style={{ transition: "stroke 0.3s ease, stroke-dasharray 0.3s ease" }}
            />
          </svg>
        ) : null}

        {/* Finger target ring (rear camera) */}
        {state.facing === "environment" ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-24 w-24 rounded-full border-2 border-dashed border-white/60" />
          </div>
        ) : null}

        {/* Live waveform during countdown + scanning */}
        {active ? <VitalScanWaveform ref={waveformRef} /> : null}

        {/* Countdown overlay */}
        <AnimatePresence>
          {state.status === "countdown" ? (
            <motion.div
              key="countdown"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/35 backdrop-blur-[2px]"
            >
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-white/80">
                {translate(language, "unone.scan.countdown")}
              </span>
              <span
                ref={countdownNumRef}
                className="animate-countdown-pop font-display text-7xl font-bold text-white"
              >
                3
              </span>
              <button
                type="button"
                onClick={handleSkip}
                className="mt-2 inline-flex items-center gap-1 rounded-full bg-white/15 px-4 py-1.5 text-xs font-bold text-white"
              >
                <SkipForward className="h-3.5 w-3.5" />
                {translate(language, "unone.scan.countdown.skip")}
              </button>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* Scanning overlay: progress + detecting label */}
        {state.status === "scanning" ? (
          <div className="absolute inset-x-0 bottom-[88px] px-4">
            <p className="mb-1 text-center text-xs font-bold text-white">
              {translate(language, "unone.scan.detecting")}
            </p>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/25">
              <div
                ref={progressFillRef}
                className="h-full rounded-full bg-emerald-400"
                style={{ width: "0%" }}
              />
            </div>
            <p className="mt-1 text-center text-[11px] font-semibold text-white/85">
              <span ref={progressLabelRef}>{`0s / ${DURATION_SECONDS}s`}</span>
            </p>
          </div>
        ) : null}
      </div>

      {/* Live quality meters during countdown + scanning */}
      {active ? (
        <div className="grid grid-cols-3 gap-3">
          <QualityMeter
            label={translate(language, "unone.scan.lighting")}
            pct={lightingPct}
            color={lightingColor}
          />
          <QualityMeter
            label={translate(language, "unone.scan.motionMeter")}
            pct={motionPct}
            color={motionColor}
          />
          <QualityMeter
            label={translate(language, "unone.scan.stability")}
            pct={stabilityPct}
            color={stabilityColor}
          />
        </div>
      ) : null}

      {/* Status banners */}
      {state.status === "permission_denied" ? (
        <Banner tone="red">{translate(language, "unone.scan.permissionDenied")}</Banner>
      ) : null}
      {state.status === "camera_unavailable" ? (
        <Banner tone="amber">{translate(language, "unone.scan.unavailable")}</Banner>
      ) : null}
      {state.qualityHint === "no_face" ? (
        <Banner tone="amber">{translate(language, "unone.scan.noFace")}</Banner>
      ) : null}
      {state.qualityHint === "low_light" ? (
        <Banner tone="amber">{translate(language, "unone.scan.lowLight")}</Banner>
      ) : null}
      {state.qualityHint === "motion" ? (
        <Banner tone="amber">{translate(language, "unone.scan.motion")}</Banner>
      ) : null}
      {state.qualityHint === "finger_cover_camera" ? (
        <Banner tone="amber">{translate(language, "unone.scan.fingerCoverCamera")}</Banner>
      ) : null}
      {state.qualityHint === "finger_press_lighter" ? (
        <Banner tone="amber">{translate(language, "unone.scan.fingerPressLighter")}</Banner>
      ) : null}
      {state.qualityHint === "finger_warm_hands" ? (
        <Banner tone="amber">{translate(language, "unone.scan.fingerWarmHands")}</Banner>
      ) : null}
      {state.status === "failed" && !state.result && state.error === "model_load_failed" ? (
        <Banner tone="amber">{translate(language, "unone.scan.modelLoadError")}</Banner>
      ) : null}
      {state.status === "failed" && !state.result && state.error === "stability_timeout" ? (
        <Banner tone="amber">{translate(language, "unone.scan.stabilityTimeout")}</Banner>
      ) : null}

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={!state.consentGiven || active}
          onClick={handleStart}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--brand-700)] px-5 py-3 text-sm font-bold text-white shadow-sm disabled:opacity-50"
        >
          <Camera className="h-4 w-4" />
          {translate(language, "unone.scan.start")}
        </button>
        {state.facing === "environment" && torchSupported ? (
          <button
            type="button"
            onClick={toggleTorch}
            aria-pressed={torchOn}
            className={`inline-flex items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-bold shadow-sm transition ${
              torchOn
                ? "bg-amber-500 text-white"
                : "border border-[var(--border-soft)] bg-white text-[var(--slate-800)]"
            }`}
          >
            {torchOn ? <Flashlight className="h-4 w-4" /> : <FlashlightOff className="h-4 w-4" />}
            {translate(language, "unone.scan.torch")}
          </button>
        ) : null}
      </div>

      {/* Result */}
      <AnimatePresence mode="wait">
        {state.result ? (
          <VitalResultCard
            key={state.result.created_at}
            language={language}
            state={state}
            onRepeat={() => dispatch({ type: "reset" })}
          />
        ) : null}
      </AnimatePresence>
    </section>
  );
}

function QualityMeter({
  label,
  pct,
  color,
}: {
  label: string;
  pct: MotionValue<string>;
  color: MotionValue<string>;
}) {
  return (
    <div>
      <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-[var(--slate-500)]">
        {label}
      </p>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
        <motion.div className="h-full rounded-full" style={{ width: pct, backgroundColor: color }} />
      </div>
    </div>
  );
}

function Banner({ tone, children }: { tone: "red" | "amber"; children: React.ReactNode }) {
  const cls =
    tone === "red"
      ? "bg-red-50 text-red-800"
      : "bg-amber-50 text-amber-800";
  return <p className={`rounded-2xl px-4 py-3 text-sm ${cls}`}>{children}</p>;
}

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
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
  const countRef = useRef<HTMLSpanElement | null>(null);
  const bpm = result.heart_rate_bpm;

  // Count-up BPM, imperative (no setState) — lint-safe.
  useEffect(() => {
    const span = countRef.current;
    if (!span || !bpm) return;
    let raf = 0;
    const startTs = performance.now();
    const duration = 1000;
    const step = () => {
      const t = Math.min(1, (performance.now() - startTs) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      span.textContent = String(Math.round(bpm * eased));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [bpm]);

  const ringColor =
    result.confidence_label === "good"
      ? "#10b981"
      : result.confidence_label === "moderate"
        ? "#f59e0b"
        : result.confidence_label === "low"
          ? "#f97316"
          : "#e11d48";
  const titleLabel =
    result.confidence_label === "good"
      ? "unone.scan.success"
      : result.confidence_label === "low"
        ? "unone.scan.lowConfidence"
        : result.confidence_label === "fail"
          ? "unone.scan.failed"
          : "unone.scan.success";

  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - result.confidence);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ type: "spring", stiffness: 260, damping: 28 }}
      className="space-y-3 rounded-[26px] border border-[var(--border-soft)] bg-white p-4 shadow-sm"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {/* Confidence ring + BPM */}
          <div className="relative h-20 w-20 shrink-0">
            <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90">
              <circle cx="32" cy="32" r={radius} fill="none" stroke="rgba(15,23,42,0.08)" strokeWidth="5" />
              <motion.circle
                cx="32"
                cy="32"
                r={radius}
                fill="none"
                stroke={ringColor}
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={circumference}
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset: offset }}
                transition={{ duration: 1, ease: "easeOut" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span
                ref={countRef}
                className="font-display text-2xl font-bold text-[var(--slate-950)]"
              >
                {bpm ?? "—"}
              </span>
              <span className="text-[9px] font-bold uppercase tracking-wide text-[var(--slate-500)]">
                bpm
              </span>
            </div>
          </div>
          <div>
            <p className="text-sm font-bold text-[var(--slate-950)]">
              {translate(language, titleLabel)}
            </p>
            <p className="text-xs text-[var(--slate-600)]">
              {translate(language, "unone.scan.confidence")}: {Math.round(result.confidence * 100)}%
            </p>
            {result.respiratory_rate_bpm != null ? (
              <p className="mt-1 text-xs font-semibold text-sky-700">
                {translate(language, "unone.scan.rr")}: {result.respiratory_rate_bpm} /min
              </p>
            ) : null}
          </div>
        </div>
        <span className="rounded-full bg-[var(--surface-muted)] px-3 py-1 text-[10px] font-bold text-[var(--brand-700)]">
          {translate(language, "unone.scan.experimental")}
        </span>
      </div>

      {result.repeat_scan_recommended ? (
        <motion.button
          type="button"
          onClick={onRepeat}
          whileTap={{ scale: 0.97 }}
          className="inline-flex items-center gap-2 rounded-full bg-amber-600 px-5 py-3 text-sm font-bold text-white"
        >
          <RefreshCw className="h-4 w-4" />
          {translate(language, "unone.scan.repeat")}
        </motion.button>
      ) : null}

      <p className="text-[11px] leading-4 text-[var(--slate-500)]">
        {translate(language, "unone.scan.experimental")}
      </p>

      {state.status === "offline_saved" ? (
        <p className="text-xs text-amber-700">{translate(language, "unone.scan.offlineSaved")}</p>
      ) : state.status === "synced" ? (
        <p className="text-xs text-emerald-700">{translate(language, "unone.scan.synced")}</p>
      ) : null}
    </motion.div>
  );
}