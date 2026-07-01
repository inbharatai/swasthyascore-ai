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
  | "scanning"
  | "failed"
  | "low_confidence"
  | "success"
  | "offline_saved"
  | "synced";

export interface CameraScanState {
  status: ScanStatus;
  facing: CameraFacing;
  cameraMode: VitalScanResult["camera_mode"];
  progress: number; // 0..1
  consentGiven: boolean;
  online: boolean;
  result: VitalScanResult | null;
  error: string | null;
}

export type CameraScanAction =
  | { type: "grant_consent" }
  | { type: "revoke_consent" }
  | { type: "request_permission" }
  | { type: "permission_denied" }
  | { type: "camera_unavailable" }
  | { type: "start_scan" }
  | { type: "progress"; fraction: number }
  | { type: "no_face" }
  | { type: "low_light" }
  | { type: "motion" }
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
    case "start_scan":
      if (!state.consentGiven) return state;
      return { ...state, status: "scanning", progress: 0, result: null, error: null };
    case "progress":
      return { ...state, progress: action.fraction };
    case "no_face":
      return { ...state, status: "no_face" };
    case "low_light":
      return { ...state, status: "low_light" };
    case "motion":
      return { ...state, status: "motion" };
    case "switch_camera": {
      const nextFacing: CameraFacing =
        state.facing === "user" ? "environment" : "user";
      return {
        ...state,
        status: "switching",
        facing: nextFacing,
        cameraMode: cameraFacingToMode(nextFacing, false),
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
      return { ...state, status, progress: 1, result: action.result };
    }
    case "scan_failed":
      return { ...state, status: "failed", error: action.error };
    case "save_offline":
      return { ...state, status: "offline_saved" };
    case "synced":
      return { ...state, status: "synced" };
    case "reset":
      return { ...initialCameraScanState, online: state.online };
    default:
      return state;
  }
}