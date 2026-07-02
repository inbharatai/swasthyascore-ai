import type { VitalScanResult } from "@/modules/unone-health/core/types";

/**
 * Pure camera-scan state machine. Kept free of DOM/timers so the UI reducer and
 * the unit tests share one source of truth for every scan state the spec lists.
 */
export type CameraFacing = "user" | "environment";

export type ScanStatus =
  | "idle"
  | "requesting_permission"
  | "permission_denied"
  | "camera_unavailable"
  | "no_face"
  | "low_light"
  | "motion"
  | "switching"
  | "countdown"
  | "scanning"
  | "failed"
  | "low_confidence"
  | "success"
  | "offline_saved"
  | "synced";

/** Transient per-frame quality hint, decoupled from the scan lifecycle so a
 * missing face / bad light / motion never permanently overrides "scanning".
 * The `finger_*` hints are finger-mode contact-quality cues derived from the
 * per-frame red/green/blue means (ambient leak, over-press saturation, cold
 * finger / weak pulsatility). */
export type QualityHint =
  | "no_face"
  | "low_light"
  | "motion"
  | "finger_cover_camera"
  | "finger_press_lighter"
  | "finger_warm_hands"
  | null;

export interface CameraScanState {
  status: ScanStatus;
  facing: CameraFacing;
  cameraMode: VitalScanResult["camera_mode"];
  progress: number; // 0..1
  consentGiven: boolean;
  online: boolean;
  result: VitalScanResult | null;
  error: string | null;
  qualityHint: QualityHint;
  /** Seconds remaining in the pre-scan "get ready" countdown (3..0). Only
   * meaningful while `status === "countdown"`. */
  countdownRemaining: number;
}

export type CameraScanAction =
  | { type: "grant_consent" }
  | { type: "revoke_consent" }
  | { type: "request_permission" }
  | { type: "permission_denied" }
  | { type: "camera_unavailable" }
  | { type: "begin_countdown" }
  | { type: "countdown_tick"; remaining: number }
  | { type: "stability_timeout" }
  | { type: "start_scan" }
  | { type: "progress"; fraction: number }
  | { type: "no_face" }
  | { type: "low_light" }
  | { type: "motion" }
  | { type: "finger_cover_camera" }
  | { type: "finger_press_lighter" }
  | { type: "finger_warm_hands" }
  | { type: "quality_ok" }
  | { type: "switch_camera" }
  | { type: "scan_complete"; result: VitalScanResult }
  | { type: "scan_failed"; error: string }
  | { type: "save_offline" }
  | { type: "synced" }
  | { type: "reset" };

export const initialCameraScanState: CameraScanState = {
  status: "idle",
  facing: "user",
  cameraMode: "front_face",
  progress: 0,
  consentGiven: false,
  online: true,
  result: null,
  error: null,
  qualityHint: null,
  countdownRemaining: 0,
};

export function cameraFacingToMode(
  facing: CameraFacing,
  fingerMode: boolean,
): VitalScanResult["camera_mode"] {
  if (facing === "user") return "front_face";
  if (fingerMode) return "rear_finger";
  return "rear_face";
}

export function cameraScanReducer(
  state: CameraScanState,
  action: CameraScanAction,
): CameraScanState {
  switch (action.type) {
    case "grant_consent":
      return { ...state, consentGiven: true };
    case "revoke_consent":
      return { ...state, consentGiven: false, status: "idle" };
    case "request_permission":
      return { ...state, status: "requesting_permission", error: null };
    case "permission_denied":
      return { ...state, status: "permission_denied" };
    case "camera_unavailable":
      return { ...state, status: "camera_unavailable" };
    case "begin_countdown":
      // Enter the pre-scan "get ready" countdown. Only valid once consent is
      // given; preserves facing/cameraMode so a mid-countdown switch cannot
      // corrupt the metadata sent to Swasthyak.
      if (!state.consentGiven) return state;
      return {
        ...state,
        status: "countdown",
        countdownRemaining: 3,
        result: null,
        error: null,
        qualityHint: null,
      };
    case "countdown_tick":
      if (state.status !== "countdown") return state;
      return { ...state, countdownRemaining: action.remaining };
    case "stability_timeout":
      return {
        ...state,
        status: "failed",
        error: "stability_timeout",
        qualityHint: null,
      };
    case "start_scan":
      if (!state.consentGiven) return state;
      return {
        ...state,
        status: "scanning",
        progress: 0,
        result: null,
        error: null,
        qualityHint: null,
      };
    case "progress":
      return { ...state, progress: action.fraction };
    case "no_face":
      return { ...state, qualityHint: "no_face" };
    case "low_light":
      return { ...state, qualityHint: "low_light" };
    case "motion":
      return { ...state, qualityHint: "motion" };
    case "finger_cover_camera":
      return { ...state, qualityHint: "finger_cover_camera" };
    case "finger_press_lighter":
      return { ...state, qualityHint: "finger_press_lighter" };
    case "finger_warm_hands":
      return { ...state, qualityHint: "finger_warm_hands" };
    case "quality_ok":
      return { ...state, qualityHint: null };
    case "switch_camera": {
      const nextFacing: CameraFacing =
        state.facing === "user" ? "environment" : "user";
      return {
        ...state,
        status: "switching",
        facing: nextFacing,
        // Rear camera is the fingertip scan (HR only); front camera is the
        // face scan (HR + RR). fingerMode=true maps rear -> rear_finger.
        cameraMode: cameraFacingToMode(nextFacing, true),
        qualityHint: null,
      };
    }
    case "scan_complete": {
      const label = action.result.confidence_label;
      const status: ScanStatus =
        label === "good"
          ? "success"
          : label === "moderate"
            ? "success"
            : label === "low"
              ? "low_confidence"
              : "failed";
      return {
        ...state,
        status,
        progress: 1,
        result: action.result,
        qualityHint: null,
      };
    }
    case "scan_failed":
      return { ...state, status: "failed", error: action.error, qualityHint: null };
    case "save_offline":
      return { ...state, status: "offline_saved", qualityHint: null };
    case "synced":
      return { ...state, status: "synced", qualityHint: null };
    case "reset":
      return { ...initialCameraScanState, online: state.online };
    default:
      return state;
  }
}