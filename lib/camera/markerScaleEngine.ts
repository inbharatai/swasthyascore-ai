import type { CameraConfidence } from "@/lib/types/camera";

export interface MarkerDetectionResult {
  detectedSidePx: number;
  pixelsPerMm: number;
  confidence: CameraConfidence;
  corners: [number, number][]; // 4 corner points [x, y] in pixel coordinates
}

// Module-level singleton to avoid re-loading OpenCV.js
let openCVLoadPromise: Promise<void> | null = null;
let openCVReady = false;

declare global {
  var cv: {
    Mat: new () => CVMat;
    MatVector: new () => CVMatVector;
    aruco: {
      Dictionary_get: (id: number) => CVArucoDictionary;
      DetectorParameters_create: () => CVArucoDetectorParams;
      detectMarkers: (
        image: CVMat,
        dictionary: CVArucoDictionary,
        corners: CVMatVector,
        ids: CVMat,
        params?: CVArucoDetectorParams,
      ) => void;
    };
    cvtColor: (src: CVMat, dst: CVMat, code: number) => void;
    COLOR_RGBA2GRAY: number;
    matFromImageData: (imageData: ImageData) => CVMat;
  };
}

interface CVMat {
  rows: number;
  cols: number;
  data32F: Float32Array;
  size: () => { width: number; height: number };
  delete: () => void;
}

interface CVMatVector {
  size: () => number;
  get: (i: number) => CVMat;
  delete: () => void;
}

interface CVArucoDictionary {
  delete: () => void;
}

interface CVArucoDetectorParams {
  delete: () => void;
}

/**
 * Dynamically loads OpenCV.js from CDN. Returns a promise that resolves when ready.
 * Safe to call multiple times — only loads once.
 */
export function loadOpenCV(): Promise<void> {
  if (openCVReady) return Promise.resolve();
  if (openCVLoadPromise) return openCVLoadPromise;

  openCVLoadPromise = new Promise<void>((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("OpenCV.js can only load in the browser."));
      return;
    }

    let settled = false;
    const finishResolve = () => {
      if (settled) return;
      settled = true;
      openCVReady = true;
      resolve();
    };
    const finishReject = (error: Error) => {
      if (settled) return;
      settled = true;
      openCVLoadPromise = null;
      reject(error);
    };

    const timeoutId = window.setTimeout(() => {
      finishReject(new Error("OpenCV.js initialization timed out."));
    }, 15000);

    // OpenCV.js reads Module during bootstrap; define it before loading script.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).Module = {
      onRuntimeInitialized: () => {
        window.clearTimeout(timeoutId);
        finishResolve();
      },
    };

    const script = document.createElement("script");
    script.src = "https://docs.opencv.org/4.x/opencv.js";
    script.async = true;
    script.onload = () => {
      // Fallback for builds that expose cv immediately.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((window as any).cv?.Mat) {
        window.clearTimeout(timeoutId);
        finishResolve();
      }
    };
    script.onerror = () => {
      window.clearTimeout(timeoutId);
      finishReject(new Error("Failed to load OpenCV.js from CDN."));
    };
    document.head.appendChild(script);
  });

  return openCVLoadPromise;
}

/**
 * Detects an ArUco marker (DICT_4X4_50) in the given ImageData.
 * Returns the detected marker's pixel side length, pixels-per-mm ratio,
 * corner coordinates, and a confidence rating.
 *
 * @param imageData - Raw ImageData from a canvas drawImage call
 * @param expectedSideLengthMm - Real-world side length of the printed marker in mm
 */
export function detectArucoMarker(
  imageData: ImageData,
  expectedSideLengthMm: number,
): MarkerDetectionResult | null {
  if (!openCVReady || typeof globalThis.cv === "undefined") return null;

  const cv = globalThis.cv;
  let mat: CVMat | null = null;
  let gray: CVMat | null = null;
  let corners: CVMatVector | null = null;
  let ids: CVMat | null = null;
  let dict: CVArucoDictionary | null = null;
  let params: CVArucoDetectorParams | null = null;

  try {
    mat = cv.matFromImageData(imageData);
    gray = new cv.Mat();
    cv.cvtColor(mat, gray, cv.COLOR_RGBA2GRAY);

    // DICT_4X4_50 = 0 in OpenCV ArUco
    dict = cv.aruco.Dictionary_get(0);
    params = cv.aruco.DetectorParameters_create();
    corners = new cv.MatVector();
    ids = new cv.Mat();

    cv.aruco.detectMarkers(gray, dict, corners, ids, params);

    const numDetected = corners.size();
    if (numDetected === 0) return null;

    // Use the first detected marker
    const cornerMat = corners.get(0);
    const data = cornerMat.data32F;

    // 4 corners: [x0,y0, x1,y1, x2,y2, x3,y3]
    const pts: [number, number][] = [
      [data[0]!, data[1]!],
      [data[2]!, data[3]!],
      [data[4]!, data[5]!],
      [data[6]!, data[7]!],
    ];

    // Compute side lengths from corner distances
    function dist(a: [number, number], b: [number, number]): number {
      return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2);
    }

    const sides = [
      dist(pts[0]!, pts[1]!),
      dist(pts[1]!, pts[2]!),
      dist(pts[2]!, pts[3]!),
      dist(pts[3]!, pts[0]!),
    ];

    const avgSidePx = sides.reduce((a, b) => a + b, 0) / sides.length;
    const sideVariance =
      sides.reduce((acc, s) => acc + Math.abs(s - avgSidePx), 0) / sides.length;

    const pixelsPerMm = avgSidePx / expectedSideLengthMm;

    // Confidence: low variance + reasonable size → high
    const confidence: CameraConfidence =
      sideVariance / avgSidePx < 0.05 && avgSidePx > 30 ? "high" : "medium";

    cornerMat.delete();

    return {
      detectedSidePx: avgSidePx,
      pixelsPerMm,
      confidence,
      corners: pts,
    };
  } catch {
    return null;
  } finally {
    mat?.delete();
    gray?.delete();
    corners?.delete();
    ids?.delete();
    dict?.delete();
    params?.delete();
  }
}
