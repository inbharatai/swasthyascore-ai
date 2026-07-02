"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import { computeWaveformPoints } from "@/modules/unone-health/health-skills/rppg-vital-scan/waveform";

/**
 * Imperative live PPG waveform. The scan's rAF loop calls `draw(samples)` each
 * frame with the latest green-channel window; this component renders to a
 * `<canvas>` with zero React state / re-renders (so it never trips React 19's
 * set-state-in-effect lint rule and never competes with the 60fps capture loop).
 *
 * DPI-aware (sharp on retina phones) and resize-aware via ResizeObserver.
 */
export interface VitalScanWaveformHandle {
  draw: (samples: number[]) => void;
  clear: () => void;
}

export const VitalScanWaveform = forwardRef<VitalScanWaveformHandle>(
  function VitalScanWaveform(_props, ref) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const sizeRef = useRef<{ w: number; h: number; dpr: number }>({
      w: 0,
      h: 0,
      dpr: 1,
    });

    const applySize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const parent = canvas.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
      const w = Math.max(1, Math.round(rect.width));
      const h = Math.max(1, Math.round(rect.height));
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w, h, dpr };
    };

    useEffect(() => {
      applySize();
      const parent = canvasRef.current?.parentElement;
      if (!parent || typeof ResizeObserver === "undefined") return;
      const ro = new ResizeObserver(() => applySize());
      ro.observe(parent);
      return () => ro.disconnect();
    }, []);

    const draw = (samples: number[]) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;
      const { w, h } = sizeRef.current;
      if (w <= 0 || h <= 0) return;

      ctx.clearRect(0, 0, w, h);
      const points = computeWaveformPoints(samples, w, h);
      if (points.length === 0) return;

      // Faint fill under the curve for depth.
      ctx.beginPath();
      ctx.moveTo(points[0].x, h);
      for (const p of points) ctx.lineTo(p.x, p.y);
      ctx.lineTo(points[points.length - 1].x, h);
      ctx.closePath();
      ctx.fillStyle = "rgba(52, 211, 153, 0.16)";
      ctx.fill();

      // Bright emerald trace.
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (const p of points) ctx.lineTo(p.x, p.y);
      ctx.strokeStyle = "#34d399";
      ctx.lineWidth = 2;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.shadowColor = "rgba(52, 211, 153, 0.5)";
      ctx.shadowBlur = 6;
      ctx.stroke();
      ctx.shadowBlur = 0;
    };

    const clear = () => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      const { w, h } = sizeRef.current;
      if (canvas && ctx && w > 0 && h > 0) ctx.clearRect(0, 0, w, h);
    };

    useImperativeHandle(ref, () => ({ draw, clear }), []);

    return (
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 w-full">
        <canvas ref={canvasRef} className="h-full w-full" />
      </div>
    );
  },
);