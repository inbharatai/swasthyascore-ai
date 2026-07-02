import type { VitalScanResult } from "@/modules/unone-health/core/types";
import {
  buildConfidenceBlock,
  applyConfidencePolicy,
  labelForConfidence,
} from "./confidence";
import {
  detrend,
  bandpass,
  signalQualityScore,
  estimateRespiratoryRateRpm,
} from "./signal";
import {
  estimateHeartRateFromFrames,
  type HeartRateMode,
  type HeartRateEstimate,
} from "./heartRate";

/**
 * Engine contract. The runtime picks the engine; the UI never calls OpenAI for
 * vitals. `id` is surfaced on the result so a synthetic test fixture can never
 * be mistaken for a real on-device measurement.
 *
 * The UI owns the live camera loop and calls the pure helpers
 * (`aggregateFrameSamples`, `finalizeVitalScan`) directly, feeding real frames
 * captured from the phone camera. This keeps the UI timer honest and lets tests
 * run with zero real timers using synthetic signal fixtures.
 */
export interface RppgEngine {
  readonly id: "signal";
  scan(params: RppgScanParams): Promise<RppgScanSamples>;
}

export interface RppgScanParams {
  cameraMode: VitalScanResult["camera_mode"];
  durationSeconds: number;
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}

export interface RppgScanSamples {
  /** Per-frame red mean (finger-mode signal; feeds POS for face). */
  red: number[];
  /** Per-frame green mean (face-mode primary channel; feeds POS). */
  green: number[];
  /** Per-frame blue mean (feeds POS for face). */
  blue: number[];
  timestampsMs: number[];
  /** Per-frame motion quality (0..1). */
  motion: number[];
  /** Per-frame lighting quality (0..1). */
  lighting: number[];
  /** Per-frame face/ROI stability (0..1). */
  stability: number[];
  /** Aggregate (mean) sub-scores used by the confidence block. */
  faceRoiStability: number;
  motionScore: number;
  lightingScore: number;
  signalQuality: number;
  leftRightRoiConsistency: number;
  sampleRate: number;
}

/** A single per-frame measurement produced by a camera sampler. `redMean`/
 * `blueMean` are optional so legacy single-channel fixtures keep compiling; a
 * face-mode scan must supply them (POS needs all three channels). For finger
 * mode the red mean is carried in `greenMean` historically AND now `redMean`. */
export interface RppgFrameSample {
  greenMean: number;
  redMean?: number;
  blueMean?: number;
  timestampMs: number;
  /** Media timestamp of the underlying video frame (for dedup); falls back to
   * `timestampMs` when the provider cannot read it. */
  mediaTime?: number;
  faceStability: number;
  motionScore: number;
  lightingScore: number;
  leftRightConsistency: number;
}

/** Aggregate per-frame samples into the shape the finaliser expects. */
export function aggregateFrameSamples(
  frames: RppgFrameSample[],
): RppgScanSamples {
  const empty: RppgScanSamples = {
    red: [],
    green: [],
    blue: [],
    timestampsMs: [],
    motion: [],
    lighting: [],
    stability: [],
    faceRoiStability: 0,
    motionScore: 0,
    lightingScore: 0,
    signalQuality: 0,
    leftRightRoiConsistency: 0,
    sampleRate: 0,
  };
  if (frames.length === 0) return empty;

  const mean = (selector: (f: RppgFrameSample) => number) =>
    frames.reduce((sum, f) => sum + selector(f), 0) / frames.length;

  const green = frames.map((f) => f.greenMean);
  // Legacy single-channel fixtures (no redMean/blueMean) default to green so
  // they still produce a trace; real face scans supply all three.
  const red = frames.map((f) => f.redMean ?? f.greenMean);
  const blue = frames.map((f) => f.blueMean ?? f.greenMean);
  const timestampsMs = frames.map((f) => f.timestampMs);
  const motion = frames.map((f) => f.motionScore);
  const lighting = frames.map((f) => f.lightingScore);
  const stability = frames.map((f) => f.faceStability);
  const span = (timestampsMs[timestampsMs.length - 1] - timestampsMs[0]) / 1000;
  const sampleRate = span > 0 ? (frames.length - 1) / span : 30;

  const synthetic = bandpass(detrend(green), sampleRate || 30, 0.75, 3.0);
  return {
    red,
    green,
    blue,
    timestampsMs,
    motion,
    lighting,
    stability,
    faceRoiStability: mean((f) => f.faceStability),
    motionScore: mean((f) => f.motionScore),
    lightingScore: mean((f) => f.lightingScore),
    signalQuality: Math.min(
      1,
      signalQualityScore(synthetic) * 0.6 + mean((f) => f.lightingScore) * 0.4,
    ),
    leftRightRoiConsistency: mean((f) => f.leftRightConsistency),
    sampleRate,
  };
}

/**
 * Pure finaliser shared by every engine. Runs the actual HR/RR estimation from
 * the per-frame RGB + quality traces and applies the confidence policy (nulls
 * HR/RR on fail, recommends repeat below good). No DOM access.
 *
 * Heart rate now flows through `estimateHeartRateFromFrames` (POS/red → SPA →
 * zero-phase bandpass → Welch + autocorr reconciliation + snrSQI/rdspSQI
 * gates). The estimate's trust (SNR + per-window agreement) caps the reported
 * confidence so a well-lit-but-noisy capture cannot be reported as "good".
 */
export function finalizeVitalScan(
  samples: RppgScanSamples,
  params: RppgScanParams,
  engineId: "signal",
  nowIso: string,
): VitalScanResult {
  const confidenceBlock = buildConfidenceBlock({
    faceRoiStability: samples.faceRoiStability,
    motionScore: samples.motionScore,
    lightingScore: samples.lightingScore,
    signalQuality: samples.signalQuality,
    leftRightRoiConsistency: samples.leftRightRoiConsistency,
  });

  const mode: HeartRateMode =
    params.cameraMode === "front_face" ? "front_face" : "rear_finger";
  const hrEstimate = estimateHeartRateFromFrames({
    r: samples.red,
    g: samples.green,
    b: samples.blue,
    timestampsMs: samples.timestampsMs,
    motion: samples.motion,
    lighting: samples.lighting,
    stability: samples.stability,
    mode,
  });

  const heartRateBpm = hrEstimate.bpm;
  // RR is only meaningful for face mode and only when the HR estimate is
  // trustworthy (a failed HR gate means the capture is too noisy for RR too).
  const respiratoryRateBpm =
    params.cameraMode === "front_face" && heartRateBpm != null
      ? estimateRespiratoryRateRpm(samples.green, samples.sampleRate)
      : null;

  // Cap confidence by signal trust so a noisy capture never reads as "good".
  const hrTrust = heartRateBpm != null ? hrTrustScore(hrEstimate) : 0;
  const qualityConfidence = confidenceBlock.confidence;
  const confidence =
    heartRateBpm != null
      ? Math.min(qualityConfidence, 0.35 + 0.65 * hrTrust)
      : Math.min(qualityConfidence, 0.45); // no trustworthy HR → at most "low"
  // Recompute the label from the capped confidence so the policy (null on fail,
  // repeat below good) acts on the honest value, not the quality-only one.
  const confidence_label = labelForConfidence(confidence);

  const base: VitalScanResult = {
    event_type: "vital_scan",
    source: "unone_health",
    camera_mode: params.cameraMode,
    heart_rate_bpm: heartRateBpm,
    respiratory_rate_bpm: respiratoryRateBpm,
    confidence,
    confidence_label,
    signal_quality: confidenceBlock.signal_quality,
    lighting_quality: confidenceBlock.lighting_quality,
    motion_detected: confidenceBlock.motion_detected,
    face_stability: confidenceBlock.face_stability,
    duration_seconds: params.durationSeconds,
    raw_video_uploaded: false,
    repeat_scan_recommended: false,
    created_at: nowIso,
    engine: engineId,
  };

  return applyConfidencePolicy(base);
}

/** Trust score (0..1) for an accepted HR estimate: 50% spectral SNR + 50%
 * per-window agreement. Used to cap confidence. */
function hrTrustScore(hr: HeartRateEstimate): number {
  const agreement =
    hr.totalWindows > 0 ? hr.acceptedWindows / hr.totalWindows : 1;
  return Math.max(0, Math.min(1, 0.5 * hr.snr + 0.5 * agreement));
}