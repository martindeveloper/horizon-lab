"use client";

import { useEffect, useMemo, useRef } from "react";

import { prefersReducedMotion } from "@horizon/toolkit/environment";
import { frameMeter } from "@horizon/toolkit/rendering";
import { blackbodyColor } from "@horizon/toolkit/science";

import { glowOf } from "../lib/model/glow";
import type { Observation } from "../lib/model/spectrum";
import { canvasScale, context2d } from "../lib/quality";
import { createFlock } from "../lib/scene/flock";
import { layout } from "../lib/scene/layout";
import { drawScene, sameScene, type SceneInputs, type SceneLabels } from "../lib/scene/paint";
import { useSpectroscopy } from "../lib/store";
import { useDrawingGamut } from "./use-gamut";

export type { SceneLabels };

/** The scene at most this often while photons fly: smooth enough, and half a 60 Hz budget. */
const FRAME_MS = 1000 / 30;

/**
 * The bench or the sky above the spectrum: where the light starts (a star's limb in its true
 * colour, or a lamp), the gas it crosses, Earth's air, and the spectrograph that spreads it
 * into the ribbon below. Optional photons sketch what happens: most cross, those at a line's
 * wavelength are absorbed and sent off in other directions. Schematic, and still under reduced
 * motion or when switched off.
 *
 * Kind to batteries: the still scene is drawn into its own layer only when it changes; while
 * photons fly, a frame (at most 30 a second) stamps that layer and draws them, and nothing
 * runs while the canvas is out of sight or the page hidden.
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
    let frame = 0;
    let last = 0;

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
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      if (now - last < FRAME_MS) return;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
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
      frameMeter.tick(now);
    };
    const start = () => {
      if (frame || !visible || document.hidden) return;
      last = performance.now() - FRAME_MS;
      frame = requestAnimationFrame(tick);
    };
    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
    };
    /* Out of sight (scrolled away, a sheet over it, immersive off) or a hidden page: no frames. */
    const sight = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true;
      if (visible) start();
      else stop();
    });
    sight.observe(el);
    const onVisibility = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVisibility);
    refresh.current = null;
    start();
    return () => {
      stop();
      sight.disconnect();
      observer.disconnect();
      unsubscribe();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [photons, gamut]);

  /* A canvas keeps the colour space of its first context: a new gamut takes a new canvas. */
  return (
    <canvas
      key={gamut}
      ref={canvas}
      aria-hidden
      className="spectroscopy-scene block h-full w-full"
    />
  );
}
