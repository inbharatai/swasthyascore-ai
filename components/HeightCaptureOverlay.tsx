"use client";

import { useEffect, useRef } from "react";
import type { PoseAnalysisResult } from "@/lib/types/camera";
import type { PoseQualityResult } from "@/lib/camera/poseQualityEngine";

interface HeightCaptureOverlayProps {
  poseResult: PoseAnalysisResult | null;
  qualityResult: PoseQualityResult;
  videoWidth: number;
  videoHeight: number;
  markerCorners?: [number, number][] | null; // 4 corners in [x,y] pixel coords relative to video
}

export function HeightCaptureOverlay({
  poseResult,
  qualityResult,
  videoWidth,
  videoHeight,
  markerCorners,
}: HeightCaptureOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || videoWidth === 0 || videoHeight === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = videoWidth;
    canvas.height = videoHeight;
    ctx.clearRect(0, 0, videoWidth, videoHeight);

    const confidenceColor =
      qualityResult.confidence === "high"
        ? "#22c55e" // green-500
        : qualityResult.confidence === "medium"
          ? "#f59e0b" // amber-500
          : "#ef4444"; // red-500

    // --- Floor line at 92% frame height ---
    ctx.save();
    ctx.strokeStyle = "rgba(148, 163, 184, 0.6)"; // slate-400
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(0, videoHeight * 0.92);
    ctx.lineTo(videoWidth, videoHeight * 0.92);
    ctx.stroke();
    ctx.restore();

    // --- Body frame box ---
    if (poseResult && poseResult.landmarks.length > 0) {
      const lm = poseResult.landmarks;

      // Compute bounding box from visible landmarks
      const visLm = lm.filter((l) => (l.visibility ?? 0.5) >= 0.3);
      if (visLm.length > 0) {
        const xs = visLm.map((l) => l.x * videoWidth);
        const ys = visLm.map((l) => l.y * videoHeight);
        const bxMin = Math.min(...xs) - 20;
        const bxMax = Math.max(...xs) + 20;
        const byMin = Math.min(...ys) - 20;
        const byMax = Math.max(...ys) + 20;

        ctx.save();
        ctx.strokeStyle = confidenceColor;
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
        ctx.strokeRect(bxMin, byMin, bxMax - bxMin, byMax - byMin);
        ctx.restore();

        // Head guide line (dashed, at nose Y or top of bounding box)
        const noseY = lm[0] ? lm[0].y * videoHeight : byMin;
        ctx.save();
        ctx.strokeStyle = confidenceColor;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(bxMin - 10, noseY);
        ctx.lineTo(bxMax + 10, noseY);
        ctx.stroke();
        ctx.restore();

        // Heel box (at ankle level)
        const leftAnkle = lm[27];
        const rightAnkle = lm[28];
        if (leftAnkle && rightAnkle) {
          const heelY = Math.max(leftAnkle.y, rightAnkle.y) * videoHeight;
          const heelBoxW = 60;
          const heelBoxH = 18;
          const heelCenterX = ((leftAnkle.x + rightAnkle.x) / 2) * videoWidth;
          ctx.save();
          ctx.strokeStyle = confidenceColor;
          ctx.lineWidth = 1.5;
          ctx.setLineDash([]);
          ctx.strokeRect(
            heelCenterX - heelBoxW / 2,
            heelY - 4,
            heelBoxW,
            heelBoxH,
          );
          ctx.restore();
        }

        // Shoulder line
        const leftShoulder = lm[11];
        const rightShoulder = lm[12];
        if (leftShoulder && rightShoulder) {
          ctx.save();
          ctx.strokeStyle = confidenceColor;
          ctx.lineWidth = 1.5;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.moveTo(leftShoulder.x * videoWidth, leftShoulder.y * videoHeight);
          ctx.lineTo(rightShoulder.x * videoWidth, rightShoulder.y * videoHeight);
          ctx.stroke();
          ctx.restore();
        }
      }

      // Landmark dots for key points
      const keyIndices = [0, 11, 12, 23, 24, 27, 28];
      for (const idx of keyIndices) {
        const point = lm[idx];
        if (point && (point.visibility ?? 0.5) >= 0.3) {
          ctx.save();
          ctx.fillStyle = confidenceColor;
          ctx.beginPath();
          ctx.arc(point.x * videoWidth, point.y * videoHeight, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
    }

    // --- ArUco marker corners overlay ---
    if (markerCorners && markerCorners.length === 4) {
      ctx.save();
      ctx.strokeStyle = "#22c55e";
      ctx.lineWidth = 2.5;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(markerCorners[0]![0], markerCorners[0]![1]);
      for (let i = 1; i < 4; i++) {
        ctx.lineTo(markerCorners[i]![0], markerCorners[i]![1]);
      }
      ctx.closePath();
      ctx.stroke();
      // Dot at first corner
      ctx.fillStyle = "#22c55e";
      ctx.beginPath();
      ctx.arc(markerCorners[0]![0], markerCorners[0]![1], 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }, [poseResult, qualityResult, videoWidth, videoHeight, markerCorners]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 h-full w-full"
      style={{ objectFit: "cover" }}
    />
  );
}
