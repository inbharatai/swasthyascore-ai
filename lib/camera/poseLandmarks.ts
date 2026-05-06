import type {
  BodyRiskEstimateInput,
  CameraConfidence,
  PoseAnalysisResult,
  PoseLandmarkPoint,
} from "@/lib/types/camera";

const WASM_PATH =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const MODEL_PATH =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task";

type PoseLandmarkerInstance = {
  detectForVideo: (
    videoFrame: HTMLVideoElement,
    timestamp: number,
  ) => { landmarks?: PoseLandmarkPoint[][] };
  close?: () => void;
};

let poseLandmarkerPromise: Promise<PoseLandmarkerInstance> | null = null;

function isVideoFrameReady(videoElement: HTMLVideoElement): boolean {
  return (
    videoElement.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
    videoElement.videoWidth > 0 &&
    videoElement.videoHeight > 0
  );
}

function averageVisibility(landmarks: PoseLandmarkPoint[]) {
  const values = landmarks
    .map((landmark) => landmark.visibility)
    .filter((value): value is number => typeof value === "number");

  if (values.length === 0) {
    return 0.5;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function confidenceFromVisibility(value: number): CameraConfidence {
  if (value >= 0.75) return "high";
  if (value >= 0.5) return "medium";
  return "low";
}

function distanceX(
  landmarks: PoseLandmarkPoint[],
  firstIndex: number,
  secondIndex: number,
  width: number,
) {
  const first = landmarks[firstIndex];
  const second = landmarks[secondIndex];
  if (!first || !second) {
    return null;
  }

  return Math.abs(first.x - second.x) * width;
}

export async function createPoseLandmarker() {
  if (!poseLandmarkerPromise) {
    poseLandmarkerPromise = import("@mediapipe/tasks-vision").then(
      async ({ FilesetResolver, PoseLandmarker }) => {
        const vision = await FilesetResolver.forVisionTasks(WASM_PATH);
        const baseOptions = {
          modelAssetPath: MODEL_PATH,
        };

        try {
          return (await PoseLandmarker.createFromOptions(vision, {
            baseOptions: {
              ...baseOptions,
              delegate: "GPU",
            },
            runningMode: "VIDEO",
            numPoses: 1,
          })) as PoseLandmarkerInstance;
        } catch {
          return PoseLandmarker.createFromOptions(vision, {
            baseOptions,
            runningMode: "VIDEO",
            numPoses: 1,
          }) as Promise<PoseLandmarkerInstance>;
        }
      },
    );
  }

  return poseLandmarkerPromise;
}

export async function analyzeVideoPose(
  videoElement: HTMLVideoElement,
): Promise<PoseAnalysisResult> {
  if (!isVideoFrameReady(videoElement)) {
    return {
      landmarks: [],
      fullBodyVisible: false,
      confidence: "low",
      warnings: ["No camera frame yet. Ensure camera is enabled and visible."],
    };
  }

  const poseLandmarker = await createPoseLandmarker();
  const result = poseLandmarker.detectForVideo(videoElement, performance.now());
  const landmarks = result.landmarks?.[0] ?? [];

  if (landmarks.length === 0) {
    return {
      landmarks: [],
      fullBodyVisible: false,
      confidence: "low",
      warnings: ["No full-body pose landmarks detected. Try better lighting and a full-body view."],
    };
  }

  const visibility = averageVisibility(landmarks);
  const fullBodyVisible = [0, 11, 12, 23, 24, 27, 28].every(
    (index) => (landmarks[index]?.visibility ?? visibility) >= 0.35,
  );

  return {
    landmarks,
    fullBodyVisible,
    confidence: confidenceFromVisibility(visibility),
    warnings: fullBodyVisible
      ? []
      : ["Full body is not clearly visible. Manual measurement is preferred."],
  };
}

export function landmarksToBodyRiskInput(
  analysis: PoseAnalysisResult,
  videoWidth: number,
): BodyRiskEstimateInput {
  const shoulderWidthPx = distanceX(analysis.landmarks, 11, 12, videoWidth);
  const hipWidthPx = distanceX(analysis.landmarks, 23, 24, videoWidth);
  const leftWaist = analysis.landmarks[23];
  const rightWaist = analysis.landmarks[24];
  const waistWidthPx =
    leftWaist && rightWaist ? Math.abs(leftWaist.x - rightWaist.x) * videoWidth : null;

  return {
    fullBodyVisible: analysis.fullBodyVisible,
    shoulderWidthPx,
    hipWidthPx,
    waistWidthPx,
    poseConfidence: analysis.confidence,
  };
}

export function estimateBodyPixelHeight(
  analysis: PoseAnalysisResult,
  videoHeight: number,
) {
  if (analysis.landmarks.length === 0) {
    return null;
  }

  const visibleY = analysis.landmarks
    .filter((landmark) => (landmark.visibility ?? 0.5) >= 0.3)
    .map((landmark) => landmark.y);

  if (visibleY.length < 8) {
    return null;
  }

  const minY = Math.min(...visibleY);
  const maxY = Math.max(...visibleY);
  return Math.max(0, (maxY - minY) * videoHeight);
}

/**
 * Starts a continuous pose detection loop on a video element.
 * Returns a stop function that cancels the loop.
 */
export function startPoseStream(
  videoElement: HTMLVideoElement,
  onResult: (result: PoseAnalysisResult | null) => void,
): () => void {
  let stopped = false;
  let rafId: number;

  async function loop() {
    if (stopped) return;
    try {
      if (!isVideoFrameReady(videoElement)) {
        onResult({
          landmarks: [],
          fullBodyVisible: false,
          confidence: "low",
          warnings: ["No camera frame yet. Ensure camera is enabled and visible."],
        });
        if (!stopped) {
          rafId = requestAnimationFrame(loop);
        }
        return;
      }

      const poseLandmarker = await createPoseLandmarker();
      const rawResult = poseLandmarker.detectForVideo(videoElement, performance.now());
      const landmarks = rawResult.landmarks?.[0] ?? [];

      if (landmarks.length === 0) {
        onResult({
          landmarks: [],
          fullBodyVisible: false,
          confidence: "low",
          warnings: ["No pose detected. Try better lighting and a full-body view."],
        });
      } else {
        const visibility = averageVisibility(landmarks);
        const fullBodyVisible = [0, 11, 12, 23, 24, 27, 28].every(
          (index) => (landmarks[index]?.visibility ?? visibility) >= 0.35,
        );
        onResult({
          landmarks,
          fullBodyVisible,
          confidence: confidenceFromVisibility(visibility),
          warnings: fullBodyVisible
            ? []
            : ["Full body not clearly visible. Manual measurement preferred."],
        });
      }
    } catch {
      onResult(null);
    }

    if (!stopped) {
      rafId = requestAnimationFrame(loop);
    }
  }

  rafId = requestAnimationFrame(loop);

  return () => {
    stopped = true;
    cancelAnimationFrame(rafId);
  };
}
