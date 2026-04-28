export async function requestUserCamera(): Promise<MediaStream> {
  if (
    typeof navigator === "undefined" ||
    !navigator.mediaDevices?.getUserMedia
  ) {
    throw new Error("Camera is not available on this device or browser.");
  }

  return navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: "environment",
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
    audio: false,
  });
}

export function stopCameraStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => {
    track.stop();
  });
}

export function isCameraSupported() {
  return Boolean(
    typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia,
  );
}
