"use client";

import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";

import { REDUCED_MOTION_QUERY } from "@horizon/toolkit/environment";

/** Seconds a figure glides over: the scene's publish interval. */
const GLIDE_S = 0.25;
/** The most often a gliding figure is rewritten, ms: the scene's own clock-only rate. */
const STEP_MS = 1000 / 30;

/** A value `k` of the way from `a` to `b`: geometric where both are positive, straight otherwise. */
function between(a: number, b: number, k: number) {
  if (!Number.isFinite(a) || !Number.isFinite(b) || a === b || a < 0 !== b < 0) return b;
  if (a > 0 && b > 0) return Math.exp(Math.log(a) + (Math.log(b) - Math.log(a)) * k);
  return a + (b - a) * k;
}

type Figure = {
  node: RefObject<HTMLSpanElement | null>;
  shown: RefObject<number>;
  format: RefObject<(value: number) => string>;
};

/** Shows `v`, rewriting the text only when it reads differently. */
function paint({ node, shown, format }: Figure, v: number) {
  shown.current = v;
  const text = format.current(v);
  if (node.current && node.current.textContent !== text) node.current.textContent = text;
}

/**
 * A readout figure that glides: the scene publishes a few times a second, and a figure that
 * jumps four times a second over a scene running at sixty looks laggy. The figure eases from
 * what it shows to the latest value (geometrically where both are positive, so a range
 * shrinking tenfold reads evenly), writing its own text: the console around it renders only
 * when the scene publishes. A sign change, a value with no number and reduced motion snap.
 */
export function Glide({ value, format }: { value: number; format: (value: number) => string }) {
  const node = useRef<HTMLSpanElement>(null);
  const shown = useRef(value);
  const formatOf = useRef(format);
  const figure = useRef<Figure>({ node, shown, format: formatOf });
  /* A new format (another unit, another language) repaints what is shown. */
  useLayoutEffect(() => {
    formatOf.current = format;
    paint(figure.current, shown.current);
  });
  useEffect(() => {
    const from = shown.current;
    if (from === value) return;
    if (window.matchMedia(REDUCED_MOTION_QUERY).matches) return paint(figure.current, value);
    const began = performance.now();
    let last = 0;
    let frame = 0;
    const step = (now: number) => {
      const k = Math.min(1, (now - began) / (GLIDE_S * 1000));
      if (k >= 1 || now - last >= STEP_MS) {
        last = now;
        paint(figure.current, between(from, value, k));
      }
      frame = k < 1 ? requestAnimationFrame(step) : 0;
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <span ref={node} />;
}
