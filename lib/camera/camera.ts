import type { TranslationKey } from "@/lib/i18n";

export interface RequestCameraStreamOptions {
  deviceId?: string;
  facingMode?: "environment" | "user";
}

export function isCameraSupported() {
  return Boolean(
    typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia,
  );
}

export function isSecureCameraOrigin() {
  if (typeof window === "undefined") {
    return false;
  }

  const host = window.location.hostname;
  return (
    window.isSecureContext ||
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1"
  );
}

export function buildPreferredConstraints(
  options: RequestCameraStreamOptions,
): MediaStreamConstraints {
  // frameRate ideal 60 raises the rPPG sample rate -> sharper autocorrelation
  // peaks (more samples per cardiac cycle). `ideal` (not `max`) lets the
  // device pick a supported rate; the two-tier fallback in
  // requestCameraStream drops all ideal constraints if 60fps is rejected.
  return {
    video: options.deviceId
      ? {
          deviceId: { exact: options.deviceId },
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 60 },
        }
      : {
          facingMode: { ideal: options.facingMode ?? "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 60 },
        },
    audio: false,
  };
}

export async function requestCameraStream(
  options: RequestCameraStreamOptions = {},
): Promise<MediaStream> {
  if (!isCameraSupported()) {
    throw new Error("CAMERA_UNSUPPORTED");
  }

  if (!isSecureCameraOrigin()) {
    throw new Error("CAMERA_INSECURE_ORIGIN");
  }

  try {
    return await navigator.mediaDevices.getUserMedia(
      buildPreferredConstraints(options),
    );
  } catch (primaryError) {
    try {
      return await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
    } catch {
      throw primaryError;
    }
  }
}

export const requestUserCamera = requestCameraStream;

export function stopCameraStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => {
    track.stop();
  });
}

/** First video track of a stream, or null. */
export function getVideoTrack(
  stream: MediaStream | null,
): MediaStreamTrack | null {
  return stream?.getVideoTracks()?.[0] ?? null;
}

/**
 * Whether the track's camera exposes a torch (flash) the page can toggle. iOS
 * Safari does not surface `torch` in getCapabilities(), so this returns false
 * there — callers must render any torch UI conditionally on this.
 */
export function getTorchCapability(track: MediaStreamTrack | null): boolean {
  if (!track) return false;
  try {
    const caps = track.getCapabilities?.();
    return Boolean(caps && "torch" in caps && (caps as MediaTrackCapabilities & { torch?: boolean }).torch);
  } catch {
    return false;
  }
}

/**
 * Toggle the camera torch (flash). Resolves false if the device rejected the
 * constraint (e.g. OverconstrainedError) so callers can gracefully ignore it.
 */
export async function setTorch(
  track: MediaStreamTrack | null,
  on: boolean,
): Promise<boolean> {
  if (!track) return false;
  try {
    await track.applyConstraints({
      advanced: [{ torch: on } as MediaTrackConstraintSet],
    });
    return true;
  } catch {
    return false;
  }
}

export async function getCameraPermissionState(): Promise<
  PermissionState | "unsupported" | "unknown"
> {
  if (!isCameraSupported()) {
    return "unsupported";
  }

  try {
    const permission = await navigator.permissions?.query({
      name: "camera" as PermissionName,
    });
    return permission?.state ?? "unknown";
  } catch {
    return "unknown";
  }
}

export async function enumerateCameraDevices(): Promise<MediaDeviceInfo[]> {
  if (
    typeof navigator === "undefined" ||
    !navigator.mediaDevices?.enumerateDevices
  ) {
    return [];
  }

  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((device) => device.kind === "videoinput");
  } catch {
    return [];
  }
}

export function captureFrame(videoElement: HTMLVideoElement): string | null {
  if (!videoElement.videoWidth || !videoElement.videoHeight) {
    return null;
  }

  const canvas = document.createElement("canvas");
  canvas.width = videoElement.videoWidth;
  canvas.height = videoElement.videoHeight;
  const context = canvas.getContext("2d");
  if (!context) {
    return null;
  }

  context.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.86);
}

export function getFriendlyCameraErrorKey(error: unknown): TranslationKey {
  const name =
    typeof DOMException !== "undefined" && error instanceof DOMException
      ? error.name
      : error instanceof Error
        ? error.message
        : "";

  if (name === "CAMERA_UNSUPPORTED") {
    return "camera.unsupportedError";
  }

  if (name === "CAMERA_INSECURE_ORIGIN") {
    return "camera.insecureError";
  }

  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return "camera.permissionDeniedError";
  }

  if (
    name === "NotReadableError" ||
    name === "TrackStartError" ||
    name === "AbortError"
  ) {
    return "camera.deviceBusyError";
  }

  return "camera.genericError";
}

export function getFriendlyCameraError(error: unknown) {
  const key = getFriendlyCameraErrorKey(error);

  const messages: Partial<Record<TranslationKey, string>> = {
    "camera.unsupportedError":
      "Camera is not supported in this browser. Please upload an image.",
    "camera.insecureError":
      "Camera requires HTTPS or localhost. Please open the PWA from a secure link.",
    "camera.permissionDeniedError":
      "Camera permission was blocked. Please allow camera access in browser settings or upload an image.",
    "camera.deviceBusyError":
      "Camera is being used by another app. Close other apps and try again.",
    "camera.genericError":
      "Camera could not be opened. Please try again or upload an image.",
  } satisfies Partial<Record<TranslationKey, string>>;

  return messages[key] ?? messages["camera.genericError"];
}
