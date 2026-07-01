import type { VitalScanResult } from "@/modules/unone-health/core/types";
import {
  buildConfidenceBlock,
  applyConfidencePolicy,
} from "./confidence";
import {
  detrend,
  bandpass,
  dominantFrequencyHz,
  hzToBpm,
  signalQualityScore,
} from "./signal";

/**
 * Engine contract. The runtime picks the engine; the UI never calls OpenAI for
 * vitals. `id` is surfaced on the result so a mock result can never be mistaken
 * for a real measurement.
 *
 * Two ways to use an engine:
 *  1. `engine.scan(params)` — one-shot. Mock returns instantly; the real engine
 *     drives its own real-time loop via a FrameSampler.
 *  2. The UI owns the loop and calls the pure helpers (`synthesizeMockFrame`,
 *     `aggregateFrameSamples`, `finalizeVitalScan`) directly. This keeps the UI
 *     timer honest in both modes and lets tests run with zero real timers.
 */
export interface RppgEngine {
  readonly id: "mock" | "signal";
  scan(params: RppgScanParams): Promise<RppgScanSamples>;
}

export interface RppgScanParams {
  cameraMode: VitalScanResult["camera_mode"];
  durationSeconds: number;
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}

export interface RppgScanSamples {
  green: number[];
  timestampsMs: number[];
  faceRoiStability: number;
  motionScore: number;
  lightingScore: number;
  signalQuality: number;
  leftRightRoiConsistency: number;
  sampleRate: number;
}

/** A single per-frame measurement produced by a sampler (real or mock). */
export interface RppgFrameSample {
  greenMean: number;
  timestampMs: number;
  faceStability: number;
  motionScore: number;
  lightingScore: number;
  leftRightConsistency: number;
}

/** Aggregate per-frame samples into the shape the finaliser expects. */
export function aggregateFrameSamples(
  frames: RppgFrameSample[],
): RppgScanSamples {
  if (frames.length === 0) {
    return {
      green: [],
      timestampsMs: [],
      faceRoiStability: 0,
      motionScore: 0,
      lightingScore: 0,
      signalQuality: 0,
      leftRightRoiConsistency: 0,
      sampleRate: 0,
    };
  }
  const mean = (selector: (f: RppgFrameSample) => number) =>
    frames.reduce((sum, f) => sum + selector(f), 0) / frames.length;

  const green = frames.map((f) => f.greenMean);
  const timestampsMs = frames.map((f) => f.timestampMs);
  const span =
    (timestampsMs[timestampsMs.length - 1] - timestampsMs[0]) / 1000;
  const sampleRate = span > 0 ? (frames.length - 1) / span : 30;

  const synthetic = bandpass(detrend(green), sampleRate || 30, 0.75, 3.0);
  return {
    green,
    timestampsMs,
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
 * the green-channel trace and applies the confidence policy (nulls HR/RR on
 * fail, recommends repeat below good). No DOM access.
 */
export function finalizeVitalScan(
  samples: RppgScanSamples,
  params: RppgScanParams,
  engineId: "mock" | "signal",
  nowIso: string,
): VitalScanResult {
  const confidenceBlock = buildConfidenceBlock({
    faceRoiStability: samples.faceRoiStability,
    motionScore: samples.motionScore,
    lightingScore: samples.lightingScore,
    signalQuality: samples.signalQuality,
    leftRightRoiConsistency: samples.leftRightRoiConsistency,
  });

  const heartRateBpm = estimateHeartRate(samples);
  const respiratoryRateBpm =
    params.cameraMode === "front_face"
      ? estimateRespiratoryRate(samples)
      : null;

  const base: VitalScanResult = {
    event_type: "vital_scan",
    source: "unone_health",
    camera_mode: params.cameraMode,
    heart_rate_bpm: heartRateBpm,
    respiratory_rate_bpm: respiratoryRateBpm,
    confidence: confidenceBlock.confidence,
    confidence_label: confidenceBlock.confidence_label,
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

function estimateHeartRate(samples: RppgScanSamples): number | null {
  if (samples.green.length < 8 || samples.sampleRate <= 0) return null;
  const detrended = detrend(samples.green);
  const filtered = bandpass(detrended, samples.sampleRate, 0.75, 3.0);
  const hz = dominantFrequencyHz(filtered, samples.sampleRate);
  const bpm = hzToBpm(hz);
  if (bpm < 40 || bpm > 180) return null;
  return bpm;
}

function estimateRespiratoryRate(samples: RppgScanSamples): number | null {
  if (samples.green.length < 16 || samples.sampleRate <= 0) return null;
  const detrended = detrend(samples.green, 31);
  const filtered = bandpass(detrended, samples.sampleRate, 0.1, 0.5);
  const hz = dominantFrequencyHz(filtered, samples.sampleRate);
  const rpm = Math.round(hz * 60);
  if (rpm < 8 || rpm > 40) return null;
  return rpm;
}

/** Deterministic mock frame at time `tSeconds` for a given heart rate. */
export function synthesizeMockFrame(
  tSeconds: number,
  heartRate: number,
): RppgFrameSample {
  const heartHz = heartRate / 60;
  const pulse = Math.sin(2 * Math.PI * heartHz * tSeconds) * 0.06;
  const drift = Math.sin(tSeconds * 0.2) * 0.01;
  const noise = (pseudoRandom(Math.floor(tSeconds * 30)) - 0.5) * 0.004;
  return {
    greenMean: 128 + pulse + drift + noise,
    timestampMs: Math.round(tSeconds * 1000),
    faceStability: 0.9,
    motionScore: 0.92,
    lightingScore: 0.86,
    leftRightConsistency: 0.88,
  };
}

function pseudoRandom(seed: number): number {
  const x = Math.sin(seed * 99.13) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * MockRppgEngine — DEMO / DEV ONLY. Produces a deterministic, plausible
 * synthetic green-channel trace so the UI and tests exercise the full pipeline.
 * Every result is tagged `engine: "mock"` and must never be presented as a
 * real vital measurement.
 */
export class MockRppgEngine implements RppgEngine {
  readonly id = "mock" as const;

  constructor(private readonly seedHeartRate = 72) {}

  async scan(params: RppgScanParams): Promise<RppgScanSamples> {
    const fps = 30;
    const frameCount = Math.max(8, Math.round(fps * params.durationSeconds));
    const frames: RppgFrameSample[] = [];
    for (let i = 0; i < frameCount; i++) {
      frames.push(synthesizeMockFrame(i / fps, this.seedHeartRate));
      if (i % 10 === 0) params.onProgress?.(i / frameCount);
    }
    params.onProgress?.(1);
    return aggregateFrameSamples(frames);
  }
}