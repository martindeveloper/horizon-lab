import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useRef } from "react";

import { usePhysicsFormat } from "@/features/black-hole/hooks/use-physics-format";
import { orbitBasis, type Basis } from "@/features/black-hole/lib/frame";
import type { Vec3 } from "@/features/black-hole/lib/kerr-rays";
import { B_CRIT, schwarzschildKm } from "@/features/black-hole/lib/physics";
import {
  buildSketch,
  shadowScale,
  type Sketch,
  type SketchContext,
  type Tone,
} from "@/features/black-hole/lib/sketches";
import { useBlackHole } from "@/features/black-hole/lib/store";
import { tourFor } from "@/features/black-hole/lib/tours";
import { projectWorld } from "@horizon/toolkit/camera";
import { prefersReducedMotion } from "@horizon/toolkit/environment";

import { drawOverHole, fitOverlay, frameLoop } from "./overlay-canvas";
import { useSceneCamera } from "./scene-camera";

const FADE_OUT = 0.7;

type Shown = { key: string; sketches: Sketch[]; start: number; anchor: Basis; fade: number };

/** Hairline drawings over the hole for the current guide beat; decorative, the card carries the text. */
export function GuideSketch() {
  const cam = useSceneCamera();
  const t = useTranslations("blackHole");
  const fmt = useFormatter();
  const { formatLengthKm } = usePhysicsFormat();
  const layerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const text = useRef<Pick<
    SketchContext,
    "number" | "km" | "notToScale" | "spinZero" | "assumedSpin" | "criticalCurve"
  > | null>(null);
  useEffect(() => {
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
    const accent = root.getPropertyValue("--color-solar").trim() || "#e2c07a";
    const quiet = root.getPropertyValue("--color-space-fg").trim() || "#ecece8";
    const family = getComputedStyle(canvas).fontFamily || "monospace";
    let shown: Shown | null = null;
    let drawn = false;

    const clear = () => {
      if (!drawn) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawn = false;
    };

    return frameLoop((dt, now) => {
      if (document.hidden || !text.current) return;
      const state = useBlackHole.getState();
      const beat = tourFor(state.presetId)[state.guideBeat];
      const key =
        state.guideArrived && beat?.sketch?.length ? `${state.presetId}:${state.guideBeat}` : null;
      if (shown && shown.key !== key) {
        shown.fade -= dt / FADE_OUT;
        if (shown.fade <= 0) shown = null;
      }
      if (!shown && key && beat?.sketch) {
        shown = {
          key,
          sketches: beat.sketch,
          start: now,
          anchor: orbitBasis(cam.posX, cam.posY, cam.posZ),
          fade: 1,
        };
      }
      if (!shown) {
        clear();
        return;
      }

      const fit = fitOverlay(layer, canvas);
      if (!fit) return;
      const { width, height } = fit.holeBox;
      drawOverHole(ctx, fit);
      drawn = true;

      const live = orbitBasis(cam.posX, cam.posY, cam.posZ);
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
      const small = width < 640;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      const colour = (tone: Tone) => (tone === "accent" ? accent : quiet);
      const labelBoxes: { x: number; y: number; w: number; h: number }[] = [];

      for (const sketch of shown.sketches) {
        const { strokes, labels } = buildSketch(sketch, context);
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
        ctx.shadowColor = "rgba(0, 0, 0, 0.85)";
        ctx.shadowBlur = 6;
        for (const label of labels) {
          const a = Math.min(1, Math.max(0, (context.elapsed - label.delay) / 0.6)) * fade;
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
    });
  }, [cam]);

  return (
    <div ref={layerRef} className="pointer-events-none absolute inset-0 z-[65]" aria-hidden>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full font-mono" />
    </div>
  );
}
