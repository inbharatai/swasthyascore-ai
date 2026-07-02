import { describe, expect, it, vi } from "vitest";
import { estimateBodyRiskFromLandmarks } from "@/lib/camera/bodyRiskEstimate";
import {
  buildPreferredConstraints,
  getFriendlyCameraErrorKey,
  getTorchCapability,
  getVideoTrack,
  setTorch,
} from "@/lib/camera/camera";
import { estimateHeightWithReference } from "@/lib/camera/heightEstimate";
import { evaluateVisibleRiskFallback } from "@/lib/camera/visibleRiskRules";

describe("camera safety rules", () => {
  it("does not estimate height without a reference marker", () => {
    const result = estimateHeightWithReference({
      referenceType: "none",
      referenceHeightCm: null,
      referencePixelHeight: 200,
      bodyPixelHeight: 1200,
      poseConfidence: "high",
    });

    expect(result.estimatedHeightCm).toBeNull();
    expect(result.requiresManualConfirmation).toBe(true);
    expect(result.confidence).toBe("low");
  });

  it("estimates height only as a manually confirmed value with a reference", () => {
    const result = estimateHeightWithReference({
      referenceType: "one_meter_strip",
      referenceHeightCm: 100,
      referencePixelHeight: 700,
      bodyPixelHeight: 1190,
      poseConfidence: "high",
    });

    expect(result.estimatedHeightCm).toBe(170);
    expect(result.requiresManualConfirmation).toBe(true);
    expect(result.confidence).toBe("medium");
  });

  it("returns qualitative body-risk guidance, not weight or BMI", () => {
    const result = estimateBodyRiskFromLandmarks({
      fullBodyVisible: true,
      shoulderWidthPx: 220,
      hipWidthPx: 200,
      waistWidthPx: 190,
      poseConfidence: "high",
    });

    expect(result.category).toBe("possible_central_obesity_risk");
    expect(result.requiresManualConfirmation).toBe(true);
    expect(result.warnings.join(" ")).toContain("Confirm with waist");
  });

  it("visible-risk fallback stays non-diagnostic", () => {
    const result = evaluateVisibleRiskFallback({
      fullBodyVisible: false,
      hasFootImage: true,
      hasWalkingVideo: false,
      userReportedVisibleConcern: true,
      cameraAvailable: true,
    });

    expect(result.notDiagnosis).toBe(true);
    expect(result.category).toBe("foot_wound_concern");
    expect(result.recommendedActionKeys).toContain("next.doctorSoon");
  });

  it("maps permission denial to a friendly camera error", () => {
    const error = new DOMException("denied", "NotAllowedError");

    expect(getFriendlyCameraErrorKey(error)).toBe(
      "camera.permissionDeniedError",
    );
  });
});

describe("rPPG camera constraints — 60fps + torch helpers", () => {
  it("requests an ideal 60fps in both deviceId and facingMode branches", () => {
    const byDevice = buildPreferredConstraints({ deviceId: "cam-1" });
    const byFacing = buildPreferredConstraints({ facingMode: "environment" });
    expect((byDevice.video as MediaTrackConstraints).frameRate).toEqual({
      ideal: 60,
    });
    expect((byFacing.video as MediaTrackConstraints).frameRate).toEqual({
      ideal: 60,
    });
    // Resolution ideals are preserved alongside the new frameRate.
    expect((byDevice.video as MediaTrackConstraints).width).toEqual({
      ideal: 1280,
    });
    expect((byFacing.video as MediaTrackConstraints).height).toEqual({
      ideal: 720,
    });
    expect(byDevice.audio).toBe(false);
  });

  it("getVideoTrack returns the first video track or null", () => {
    const track = { kind: "video" } as MediaStreamTrack;
    const stream = { getVideoTracks: () => [track] } as unknown as MediaStream;
    expect(getVideoTrack(stream)).toBe(track);
    expect(getVideoTrack(null)).toBeNull();
  });

  it("getTorchCapability reflects getCapabilities().torch and is absent-safe", () => {
    const withTorch = {
      getCapabilities: () => ({ torch: true }),
    } as unknown as MediaStreamTrack;
    expect(getTorchCapability(withTorch)).toBe(true);

    const withoutTorch = {
      getCapabilities: () => ({ torch: false }),
    } as unknown as MediaStreamTrack;
    expect(getTorchCapability(withoutTorch)).toBe(false);

    const noCaps = {} as MediaStreamTrack;
    expect(getTorchCapability(noCaps)).toBe(false);
    expect(getTorchCapability(null)).toBe(false);
  });

  it("setTorch applyConstraints resolves true and swallows rejection", async () => {
    const applyConstraints = vi.fn(async () => undefined);
    const track = { applyConstraints } as unknown as MediaStreamTrack;

    expect(await setTorch(track, true)).toBe(true);
    expect(applyConstraints).toHaveBeenCalledWith({
      advanced: [{ torch: true }],
    });

    const rejecting = {
      applyConstraints: vi.fn(async () => {
        throw new DOMException("unsupported", "OverconstrainedError");
      }),
    } as unknown as MediaStreamTrack;
    expect(await setTorch(rejecting, false)).toBe(false);
    expect(await setTorch(null, true)).toBe(false);
  });
});
