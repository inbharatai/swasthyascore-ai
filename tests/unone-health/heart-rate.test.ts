import { describe, expect, it } from "vitest";
import {
  estimateHeartRateFromFrames,
  type HeartRateInput,
} from "@/modules/unone-health/health-skills/rppg-vital-scan/heartRate";

const FS = 30;

function buildInput(
  channels: { r: number[]; g: number[]; b: number[] },
  mode: HeartRateInput["mode"],
  opts: { motion?: (i: number) => number; lighting?: (i: number) => number; stability?: (i: number) => number; priorBpm?: number } = {},
): HeartRateInput {
  const n = channels.r.length;
  const timestampsMs: number[] = [];
  for (let i = 0; i < n; i++) timestampsMs.push(Math.round((i / FS) * 1000));
  const m = opts.motion ?? (() => 0.9);
  const l = opts.lighting ?? (() => 0.9);
  const s = opts.stability ?? (() => 0.9);
  return {
    r: channels.r,
    g: channels.g,
    b: channels.b,
    timestampsMs,
    motion: Array.from({ length: n }, (_, i) => m(i)),
    lighting: Array.from({ length: n }, (_, i) => l(i)),
    stability: Array.from({ length: n }, (_, i) => s(i)),
    mode,
    priorBpm: opts.priorBpm,
  };
}

function rgbPulse(hz: number, seconds: number, breathHz = 0) {
  const n = FS * seconds;
  const r: number[] = [];
  const g: number[] = [];
  const b: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / FS;
    const p = Math.sin(2 * Math.PI * hz * t);
    const breath = breathHz > 0 ? Math.sin(2 * Math.PI * breathHz * t) : 0;
    r.push(130 + p * 3);
    g.push(128 + p * 5 + breath * 5);
    b.push(126 + p * 2);
  }
  return { r, g, b };
}

function redPulse(hz: number, seconds: number, dc = 150, amp = 4) {
  const n = FS * seconds;
  const r: number[] = [];
  const g: number[] = [];
  const b: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / FS;
    r.push(dc + Math.sin(2 * Math.PI * hz * t) * amp);
    g.push(0);
    b.push(0);
  }
  return { r, g, b };
}

describe("estimateHeartRateFromFrames — end-to-end", () => {
  it("face: recovers 72 BPM from clean RGB (68–76)", () => {
    const est = estimateHeartRateFromFrames(buildInput(rgbPulse(1.2, 20), "front_face"));
    expect(est.bpm).not.toBeNull();
    expect(est.bpm!).toBeGreaterThanOrEqual(68);
    expect(est.bpm!).toBeLessThanOrEqual(76);
  });

  it("face: stays on 72 BPM under a large in-band common-mode (POS illumination invariance)", () => {
    const base = rgbPulse(1.2, 20);
    const cm = (t: number) => Math.sin(2 * Math.PI * 1.5 * t) * 12;
    const r = base.r.map((v, i) => v + cm(i / FS));
    const g = base.g.map((v, i) => v + cm(i / FS));
    const b = base.b.map((v, i) => v + cm(i / FS));
    const est = estimateHeartRateFromFrames(buildInput({ r, g, b }, "front_face"));
    expect(est.bpm).not.toBeNull();
    expect(est.bpm!).toBeGreaterThanOrEqual(68);
    expect(est.bpm!).toBeLessThanOrEqual(76);
  });

  it("finger: recovers 72 BPM from the red channel (68–76)", () => {
    const est = estimateHeartRateFromFrames(buildInput(redPulse(1.2, 20), "rear_finger"));
    expect(est.bpm).not.toBeNull();
    expect(est.bpm!).toBeGreaterThanOrEqual(68);
    expect(est.bpm!).toBeLessThanOrEqual(76);
  });

  it("motion transient mid-scan is masked → stable number or honest null (never a wrong number)", () => {
    // Frames 8–12 s have motion < 0.4 (the mask threshold) → dropped before HR.
    const motion = (i: number) => {
      const t = i / FS;
      return t >= 8 && t < 12 ? 0.2 : 0.9;
    };
    const est = estimateHeartRateFromFrames(
      buildInput(rgbPulse(1.2, 20), "front_face", { motion }),
    );
    // Either a correct-ish HR or an honest null — never a fabricated wrong one.
    // (A lone `expect(...).toBeNull()` inside an `else` is tautological — it
    // holds whenever bpm is already null — so assert the real contract in one
    // shot: the result is null OR inside the plausible band.)
    expect(est.bpm === null || (est.bpm >= 60 && est.bpm <= 90)).toBe(true);
  });

  it("locks the fundamental of a 1.2 Hz pulse train (no halving to 36 BPM)", () => {
    const n = FS * 20;
    const r: number[] = [];
    const g: number[] = [];
    const b: number[] = [];
    for (let i = 0; i < n; i++) {
      const t = i / FS;
      const phase = t * 1.2;
      const frac = phase - Math.floor(phase);
      const pulse = Math.exp(-Math.pow((frac - 0.5) / 0.04, 2));
      // Put the pulse-shaped modulation into all three channels.
      r.push(130 + pulse * 3);
      g.push(128 + pulse * 5);
      b.push(126 + pulse * 2);
    }
    const est = estimateHeartRateFromFrames(buildInput({ r, g, b }, "front_face"));
    expect(est.bpm).not.toBeNull();
    expect(est.bpm!).toBeGreaterThanOrEqual(64);
    expect(est.bpm!).toBeLessThanOrEqual(80);
  });

  it("a prior BPM does not override a high-SNR estimate (no false halving)", () => {
    // Clean 2.4 Hz (144 BPM) at high SNR. The prior-reconciliation block only
    // runs when snr < 0.3, so here it is deliberately NOT consulted — this proves
    // a confident estimate is never overridden by a prior. The low-SNR path
    // returns an honest null rather than a fabricated number (see the flat +
    // motion-transient tests), so a wrong prior can never invent a rate.
    const est = estimateHeartRateFromFrames(
      buildInput(rgbPulse(2.4, 20), "front_face", { priorBpm: 72 }),
    );
    expect(est.bpm).not.toBeNull();
    expect(est.bpm!).toBeGreaterThanOrEqual(136);
    expect(est.bpm!).toBeLessThanOrEqual(152);
  });

  it("returns null for a flat (no-pulse) capture", () => {
    const n = FS * 20;
    const flat = new Array(n).fill(128);
    const est = estimateHeartRateFromFrames(
      buildInput({ r: flat, g: flat, b: flat }, "front_face"),
    );
    expect(est.bpm).toBeNull();
  });

  it("returns null for too-short a capture (< 1 s)", () => {
    const est = estimateHeartRateFromFrames(buildInput(rgbPulse(1.2, 0.5), "front_face"));
    expect(est.bpm).toBeNull();
  });
});