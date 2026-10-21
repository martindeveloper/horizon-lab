"use client";

import { useEffect, useMemo, useRef } from "react";

import { prefersReducedMotion } from "@horizon/toolkit/environment";
import { createFrameLoop } from "@horizon/toolkit/rendering";
import { blackbodyColor } from "@horizon/toolkit/science";

import { glowOf } from "../lib/model/glow";
import type { Observation } from "../lib/model/spectrum";
import { canvasScale, context2d, SCENE_FPS } from "../lib/quality";
import { createFlock } from "../lib/scene/flock";
import { layout } from "../lib/scene/layout";
import { drawScene, sameScene, type SceneInputs, type SceneLabels } from "../lib/scene/paint";
import { useSpectroscopy } from "../lib/store";
import { useDrawingGamut } from "./use-gamut";

export type { SceneLabels };

/**
 * The bench or the sky above the spectrum: where the light starts (a star's limb in its true
 * colour, or a lamp), the gas it crosses, Earth's air, and the spectrograph that spreads it
 * into the ribbon below. Optional photons sketch what happens: most cross, those at a line's
 * wavelength are absorbed and sent off in other directions. Schematic, and still under reduced
 * motion or when switched off.
 *
 * Kind to batteries: the still scene is drawn into its own layer only when it changes; while
 * photons fly, a frame (as often as the quality allows) stamps that layer and draws them, and
 * nothing runs while the canvas is out of sight or the page hidden.
 */
export function SceneCanvas({
  obs,
  lines,
  range,
  labels,
  photons,
  teff,
}: {
  obs: Observation;
  /** Line centres and their optical depths, for which photons the gas takes. */
  lines: readonly { centre: number; tau: number }[];
  range: readonly [number, number];
  labels: SceneLabels;
  photons: boolean;
  /** The star's effective temperature, for its colour; null on the bench. */
  teff: number | null;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const gamut = useDrawingGamut();
  const halo = useSpectroscopy((s) => s.glow);
  const glow = useMemo(() => glowOf(obs, gamut), [obs, gamut]);
  const lamp = obs.kind === "slab" ? obs.background : null;
  const starColor = useMemo(() => (teff ? blackbodyColor(teff, gamut) : null), [teff, gamut]);
  const lampColor = useMemo(() => (lamp ? blackbodyColor(lamp, gamut) : null), [lamp, gamut]);
  const strong = useMemo(
    () =>
      lines.filter((l) => l.tau > 0.3 && l.centre >= range[0] && l.centre <= range[1]).slice(0, 24),
    [lines, range],
  );
  const inputs: SceneInputs = {
    kind: obs.kind,
    glowing: obs.kind === "slab" && obs.background === null,
    glow,
    starColor,
    teff,
    lampColor,
    strong,
    range,
    labels,
    gamut,
    halo,
  };
  const latest = useRef(inputs);
  /** Brings the still layer up to date after a render; set by the drawing effect. */
  const refresh = useRef<(() => void) | null>(null);
  useEffect(() => {
    latest.current = inputs;
    refresh.current?.();
  });

  useEffect(() => {
    const el = canvas.current;
    const ctx = el ? context2d(el, gamut) : null;
    const layer = document.createElement("canvas");
    const back = context2d(layer, gamut);
    if (!el || !ctx || !back) return;
    let width = 0;
    let height = 0;
    let scale = 1;
    const font = getComputedStyle(el).getPropertyValue("--font-mono") || "monospace";
    let drawn: SceneInputs | null = null;
    let geometry = layout(latest.current.kind, 0, 0);
    /** The still scene into its layer, when it or the canvas changed. */
    const paint = (force = false) => {
      if (!force && drawn && sameScene(drawn, latest.current)) return false;
      drawn = latest.current;
      back.setTransform(scale, 0, 0, scale, 0, 0);
      geometry = drawScene(back, width, height, font, drawn);
      return true;
    };
    const stamp = () => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, el.width, el.height);
      /* A collapsed canvas (a phone held sideways) has nothing to stamp, and drawImage would throw. */
      if (layer.width > 0 && layer.height > 0) ctx.drawImage(layer, 0, 0);
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
    };
    const resize = () => {
      const { quality, antialias } = useSpectroscopy.getState();
      scale = canvasScale(window.devicePixelRatio || 1, quality, antialias);
      width = el.clientWidth;
      height = el.clientHeight;
      el.width = layer.width = Math.round(width * scale);
      el.height = layer.height = Math.round(height * scale);
      paint(true);
      stamp();
    };
    resize();

    const animate = photons && !prefersReducedMotion();
    let visible = true;

    const observer = new ResizeObserver(resize);
    observer.observe(el);
    /* A new quality or anti-aliasing redraws at its scale, like a resize. */
    const unsubscribe = useSpectroscopy.subscribe((s, before) => {
      if (s.quality !== before.quality || s.antialias !== before.antialias) resize();
    });

    if (!animate) {
      refresh.current = () => {
        if (paint()) stamp();
      };
      return () => {
        refresh.current = null;
        observer.disconnect();
        unsubscribe();
      };
    }

    const flock = createFlock(gamut);
    /* The shared loop paces frames on the display's own, so a 60 Hz screen holds the cap. */
    const loop = createFrameLoop({
      render: (dt) => {
        const inputs = latest.current;
        paint();
        stamp();
        flock.step(
          dt,
          {
            range: inputs.range,
            strong: inputs.strong,
            glowing: inputs.glowing,
            air: inputs.labels.air !== null,
          },
          geometry,
          width,
          height,
        );
        flock.draw(ctx);
      },
      /* Out of sight (scrolled away, a sheet over it, immersive off): no frames. */
      paused: () => !visible,
      fps: () => SCENE_FPS[useSpectroscopy.getState().quality],
    });
    const sight = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true;
      loop.sync();
    });
    sight.observe(el);
    refresh.current = null;
    return () => {
      loop.dispose();
      sight.disconnect();
      observer.disconnect();
      unsubscribe();
    };
  }, [photons, gamut]);

  /* A canvas keeps the colour space of its first context: a new gamut takes a new canvas. */
  return (
    <canvas
      key={gamut}
      ref={canvas}
      aria-hidden
      data-simulation-canvas="spectroscopy"
      className="spectroscopy-scene block h-full w-full"
    />
  );
}
