import { describe, expect, it } from "vitest";
import {
  cameraFacingToMode,
  cameraScanReducer,
  initialCameraScanState,
  type CameraScanAction,
} from "@/lib/unone-health";

function reduce(...actions: CameraScanAction[]) {
  return actions.reduce(cameraScanReducer, initialCameraScanState);
}

describe("camera scan state machine", () => {
  it("toggles front <-> back camera and enters switching state", () => {
    const switched = cameraScanReducer(initialCameraScanState, { type: "switch_camera" });
    expect(switched.facing).toBe("environment");
    expect(switched.status).toBe("switching");
    expect(switched.cameraMode).toBe("rear_face");

    const back = cameraScanReducer(switched, { type: "switch_camera" });
    expect(back.facing).toBe("user");
    expect(back.cameraMode).toBe("front_face");
  });

  it("cameraFacingToMode maps front/rear/finger", () => {
    expect(cameraFacingToMode("user", false)).toBe("front_face");
    expect(cameraFacingToMode("environment", false)).toBe("rear_face");
    expect(cameraFacingToMode("environment", true)).toBe("rear_finger");
  });

  it("records permission denied state", () => {
    const denied = reduce({ type: "permission_denied" });
    expect(denied.status).toBe("permission_denied");
  });

  it("refuses to scan without consent", () => {
    const noConsent = cameraScanReducer(initialCameraScanState, { type: "start_scan" });
    expect(noConsent.status).toBe("idle");
  });

  it("completes a scan and routes by confidence", () => {
    const granted = cameraScanReducer(initialCameraScanState, { type: "grant_consent" });
    const scanning = cameraScanReducer(granted, { type: "start_scan" });
    expect(scanning.status).toBe("scanning");

    const goodResult = {
      event_type: "vital_scan" as const,
      source: "unone_health" as const,
      camera_mode: "front_face" as const,
      heart_rate_bpm: 72,
      respiratory_rate_bpm: 16,
      confidence: 0.85,
      confidence_label: "good" as const,
      signal_quality: "good" as const,
      lighting_quality: "good" as const,
      motion_detected: false,
      face_stability: "stable" as const,
      duration_seconds: 20,
      raw_video_uploaded: false as const,
      repeat_scan_recommended: false,
      created_at: "2026-07-01T00:00:00.000Z",
      engine: "mock" as const,
    };
    const done = cameraScanReducer(scanning, { type: "scan_complete", result: goodResult });
    expect(done.status).toBe("success");

    const lowResult = { ...goodResult, confidence: 0.5, confidence_label: "low" as const };
    const low = cameraScanReducer(scanning, { type: "scan_complete", result: lowResult });
    expect(low.status).toBe("low_confidence");

    const failResult = { ...goodResult, confidence: 0.2, confidence_label: "fail" as const, heart_rate_bpm: null, respiratory_rate_bpm: null, repeat_scan_recommended: true };
    const failed = cameraScanReducer(scanning, { type: "scan_complete", result: failResult });
    expect(failed.status).toBe("failed");
  });

  it("supports offline saved and synced states", () => {
    const offline = reduce({ type: "save_offline" });
    expect(offline.status).toBe("offline_saved");
    const synced = reduce({ type: "synced" });
    expect(synced.status).toBe("synced");
  });
});