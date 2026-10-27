import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useEffect, useRef } from "react";

import { projectWorld } from "@horizon/toolkit/camera";
import { prefersReducedMotion } from "@horizon/toolkit/environment";
import type { Vec3 } from "@horizon/toolkit/math";

import { orbitBasis, type Basis } from "../lib/frame";
import { B_CRIT, schwarzschildKm } from "../lib/physics";
import {
  buildSketch,
  LABEL_FADE,
  shadowScale,
  type Sketch,
  type SketchContext,
  type Tone,
} from "../lib/sketches";
import { useBlackHole } from "../lib/store";
import { tourFor } from "../lib/tours";
import { clearOverlay, drawOverHole, overlayFit, overlayLoop } from "./overlay-canvas";
import { useSceneCamera, useSceneFrames } from "./scene-camera";
import { usePhysicsFormat } from "./use-physics-format";

const FADE_OUT = 0.7;
/**
 * A drawing at rest is rebuilt only when the camera has moved this share of its distance
 * (about 0.06°, under a pixel at the drawings' size) or the spin or the words changed.
 */
const POSE_QUANTUM = 1e-3;

type Built = ReturnType<typeof buildSketch>;
type Shown = {
  key: string;
  sketches: Sketch[];
  start: number;
  anchor: Basis;
  fade: number;
  /** Each sketch's drawing at rest and what it was built for. */
  built: ({ key: string; drawing: Built } | null)[];
};

/** Hairline drawings over the hole for the current guide step; decorative, the card carries the text. */
export function GuideSketch() {
  const cam = useSceneCamera();
  const frames = useSceneFrames();
  const t = useTranslations("blackHole");
  const fmt = useFormatter();
  const { formatLengthKm } = usePhysicsFormat();
  const layerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const text = useRef<Pick<
    SketchContext,
    "number" | "km" | "notToScale" | "spinZero" | "assumedSpin" | "criticalCurve"
  > | null>(null);
  const locale = useLocale();
  /** The words' language, so drawings at rest are rebuilt in a new one. */
  const language = useRef(locale);
  useEffect(() => {
    language.current = locale;
    text.current = {
      number: (n, digits) =>
        fmt.number(n, { minimumFractionDigits: digits, maximumFractionDigits: digits }),
      km: formatLengthKm,
      notToScale: t("sketchNotToScale"),
      spinZero: t("sketchSpinZero"),
      assumedSpin: t("sketchAssumedSpin"),
      criticalCurve: t("sketchCriticalCurve"),
    };
  });

  useEffect(() => {
    const layer = layerRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!layer || !canvas || !ctx) return;
    const reduce = prefersReducedMotion();
    const root = getComputedStyle(document.documentElement);
    const accent = root.getPropertyValue("--color-solar").trim();
    const quiet = root.getPropertyValue("--color-space-fg").trim();
    const shadow = root.getPropertyValue("--color-shadow").trim();
    const family = getComputedStyle(canvas).fontFamily || "monospace";
    let shown: Shown | null = null;
    let drawn = false;

    const clear = () => {
      if (!drawn) return;
      clearOverlay(ctx);
      drawn = false;
    };

    /** True while a drawing is still being revealed or fading, or moves by itself while the scene animates. */
    const frame = (dt: number, now: number) => {
      if (!text.current) return false;
      const state = useBlackHole.getState();
      const step = tourFor(state.presetId)[state.guideStep];
      const key =
        state.guideArrived && step?.sketch?.length ? `${state.presetId}:${state.guideStep}` : null;
      if (shown && shown.key !== key) {
        shown.fade -= dt / FADE_OUT;
        if (shown.fade <= 0) shown = null;
      }
      if (!shown && key && step?.sketch) {
        shown = {
          key,
          sketches: step.sketch,
          start: now,
          anchor: orbitBasis(cam.posX, cam.posY, cam.posZ),
          fade: 1,
          built: step.sketch.map(() => null),
        };
      }
      if (!shown) {
        clear();
        return false;
      }

      const fit = boxes.fit();
      if (!fit) return false;
      const { width, height } = fit.holeBox;
      drawOverHole(ctx, fit);
      drawn = true;

      const live = orbitBasis(cam.posX, cam.posY, cam.posZ);
      const q = POSE_QUANTUM * cam.dist;
      const pose = [
        state.spin,
        state.massSolar,
        language.current,
        Math.round(cam.posX / q),
        Math.round(cam.posY / q),
        Math.round(cam.posZ / q),
      ].join(":");
      const context: SketchContext = {
        spin: state.spin,
        rsKm: schwarzschildKm(state.massSolar),
        elapsed: reduce ? 30 : (now - shown.start) / 1000,
        live,
        anchor: shown.anchor,
        distance: cam.dist,
        ...text.current,
      };
      const project = (p: Vec3) =>
        projectWorld(cam, p[0], p[1], p[2], width, height, { padding: 400 });
      // Scene behind the hole and inside its shadow is hidden by it.
      const centre = project([0, 0, 0]);
      const edge = project([
        live.right[0] * B_CRIT * shadowScale(cam.dist),
        0,
        live.right[2] * B_CRIT * shadowScale(cam.dist),
      ]);
      const shadowPx = Math.hypot(edge.x - centre.x, edge.y - centre.y);
      const seen = (p: Vec3, x: number, y: number) => {
        const depth =
          (p[0] - cam.posX) * cam.fwdX +
          (p[1] - cam.posY) * cam.fwdY +
          (p[2] - cam.posZ) * cam.fwdZ;
        if (depth < cam.dist + 0.2) return 1;
        const r = Math.hypot(x - centre.x, y - centre.y) / Math.max(shadowPx, 1);
        return Math.min(1, Math.max(0.06, (r - 0.9) / 0.14));
      };
      const fade = shown.fade;
      let moving = fade < 1;
      const small = width < 640;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      const colour = (tone: Tone) => (tone === "accent" ? accent : quiet);
      const labelBoxes: { x: number; y: number; w: number; h: number }[] = [];

      for (const [index, sketch] of shown.sketches.entries()) {
        /* A drawing at rest is kept until the camera, the spin or the words change. */
        const kept = shown.built[index];
        const drawing = kept?.key === pose ? kept.drawing : buildSketch(sketch, context);
        const resting = context.elapsed >= drawing.still;
        shown.built[index] = resting ? { key: pose, drawing } : null;
        /* One that never rests (a dot in Kepler time) moves while the scene animates. */
        if (!resting && (drawing.still < Infinity || !state.animationPaused)) moving = true;
        const { strokes, labels } = drawing;
        for (const stroke of strokes) {
          const q = Math.min(1, Math.max(0, (context.elapsed - stroke.delay) / stroke.duration));
          if (q <= 0) continue;
          const reveal = 1 - (1 - q) ** 3;
          const pts = stroke.points.map(project);
          const span = reveal * (pts.length - 1);
          const base = (stroke.tone === "accent" ? 0.92 : 0.5) * fade;
          ctx.strokeStyle = colour(stroke.tone);
          ctx.lineWidth = stroke.tone === "accent" ? 1.25 : 1;
          ctx.setLineDash(stroke.dashed ? [3, 6] : []);
          ctx.shadowColor = stroke.tone === "accent" ? accent : "transparent";
          ctx.shadowBlur = stroke.tone === "accent" ? 6 : 0;
          let level = -1;
          let open = false;
          let tip: { x: number; y: number } | null = null;
          let prev: { x: number; y: number } | null = null;
          for (let i = 0; i < Math.ceil(span) && i < pts.length - 1; i++) {
            const a = pts[i]!;
            let b = pts[i + 1]!;
            if (!a.visible || !b.visible) {
              if (open) ctx.stroke();
              open = false;
              continue;
            }
            const f = Math.min(1, span - i);
            if (f < 1) b = { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, visible: true };
            const v = Math.round(seen(stroke.points[i]!, a.x, a.y) * 4) / 4;
            if (v !== level || !open) {
              if (open) ctx.stroke();
              level = v;
              ctx.globalAlpha = base * v;
              ctx.beginPath();
              ctx.moveTo(a.x, a.y);
              open = true;
            }
            ctx.lineTo(b.x, b.y);
            prev = a;
            tip = b;
          }
          if (open) ctx.stroke();
          ctx.setLineDash([]);
          if (tip && prev && stroke.arrow && reveal > 0.08) {
            const ang = Math.atan2(tip.y - prev.y, tip.x - prev.x);
            ctx.globalAlpha = base;
            ctx.beginPath();
            ctx.moveTo(tip.x - 7 * Math.cos(ang - 0.45), tip.y - 7 * Math.sin(ang - 0.45));
            ctx.lineTo(tip.x, tip.y);
            ctx.lineTo(tip.x - 7 * Math.cos(ang + 0.45), tip.y - 7 * Math.sin(ang + 0.45));
            ctx.stroke();
          }
          const dot = (x: number, y: number, r: number) => {
            ctx.globalAlpha = fade;
            ctx.fillStyle = accent;
            ctx.shadowColor = accent;
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
          };
          if (tip && stroke.head && q < 1) dot(tip.x, tip.y, 2.4);
          if (stroke.marker && q >= 1) {
            const m = project(stroke.marker);
            if (m.visible && seen(stroke.marker, m.x, m.y) > 0.5) dot(m.x, m.y, 3);
          }
        }

        ctx.font = `500 ${small ? 10 : 11}px ${family}`;
        ctx.shadowColor = `color-mix(in srgb, ${shadow} 85%, transparent)`;
        ctx.shadowBlur = 6;
        for (const label of labels) {
          const a = Math.min(1, Math.max(0, (context.elapsed - label.delay) / LABEL_FADE)) * fade;
          if (a <= 0) continue;
          const s = project(label.at);
          if (!s.visible) continue;
          const w = ctx.measureText(label.text).width;
          const h = 14;
          let x = label.place === "right" ? s.x + 8 : s.x - w / 2;
          let y = label.place === "right" ? s.y + 4 : s.y - 8;
          x = Math.max(8, Math.min(width - w - 8, x));
          for (const box of labelBoxes) {
            if (x < box.x + box.w + 4 && x + w + 4 > box.x && y > box.y - h && y - h < box.y)
              y = box.y + h;
          }
          labelBoxes.push({ x, y, w, h });
          ctx.globalAlpha = a * (label.tone === "accent" ? 1 : 0.78);
          ctx.fillStyle = colour(label.tone);
          ctx.fillText(label.text, x, y);
        }
      }
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      return moving;
    };
    const loop = overlayLoop(frames, frame);
    const boxes = overlayFit(layer, canvas, loop.wake);
    return () => {
      loop.dispose();
      boxes.dispose();
    };
  }, [cam, frames]);

  return (
    <div ref={layerRef} className="pointer-events-none absolute inset-0 z-[65]" aria-hidden>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full font-mono" />
    </div>
  );
}
