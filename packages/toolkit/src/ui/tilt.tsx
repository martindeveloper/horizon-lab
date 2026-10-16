"use client";

import { useEffect, useRef, type ComponentProps } from "react";

import { FINE_POINTER_QUERY, REDUCED_MOTION_QUERY } from "../environment";
import { cn } from "./utils";

export type TiltProps = ComponentProps<"div"> & {
  /** Largest rotation at the card's edge, in degrees. Keep large cards subtle. */
  max?: number;
};

/** Easing time constants (ms): the turn follows the pointer, the lift settles a touch slower. */
const TURN = 70;
const LIFT = 110;

/**
 * Apple TV–style hover tilt. The card turns toward a mouse or pen, lifts a
 * little, and a small glare follows the pointer; descendants marked
 * `tilt-back` and `tilt-front` shift against each other for depth.
 *
 * Compositor-only: each frame writes `transform`, `translate` and `opacity`
 * on a handful of elements (no inherited custom properties, no box-shadow or
 * gradient repaints) with frame-rate independent easing, and the loop stops
 * once settled. The card is measured once per hover. Touch, coarse pointers
 * and reduced motion get a still card, including when the setting changes
 * while the page is open. Give it the radius of the card it wraps.
 */
export function Tilt({ max = 5, className, children, ...props }: TiltProps) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const reduce = window.matchMedia(REDUCED_MOTION_QUERY);
    const fine = window.matchMedia(FINE_POINTER_QUERY);
    const enabled = () => fine.matches && !reduce.matches;
    const glare = el.querySelector<HTMLElement>(":scope > .tilt-glare-clip > .tilt-glare");
    const shadow = el.querySelector<HTMLElement>(":scope > .tilt-shadow");
    let back: HTMLElement[] = [];
    let front: HTMLElement[] = [];

    let rect: DOMRect | null = null;
    const target = { x: 0, y: 0, z: 0 };
    const now = { x: 0, y: 0, z: 0 };
    let frame = 0;
    let last = 0;

    const paint = () => {
      const { x, y, z } = now;
      el.style.transform = `perspective(1600px) rotateX(${(-y * max).toFixed(3)}deg) rotateY(${(x * max).toFixed(3)}deg) scale(${(1 + z * 0.015).toFixed(4)})`;
      const b = `${(-x * 10).toFixed(2)}px ${(-y * 10).toFixed(2)}px`;
      const f = `${(x * 6).toFixed(2)}px ${(y * 6).toFixed(2)}px`;
      for (const layer of back) layer.style.translate = b;
      for (const layer of front) layer.style.translate = f;
      if (glare && rect) {
        glare.style.translate = `${((x * rect.width) / 2).toFixed(1)}px ${((y * rect.height) / 2).toFixed(1)}px`;
        glare.style.opacity = z.toFixed(3);
      }
      if (shadow) {
        // Keep these offsets under the shadow's CSS inset, or a gap opens at the edge.
        shadow.style.translate = `${(-x * 16).toFixed(1)}px ${(14 - y * 10).toFixed(1)}px`;
        shadow.style.opacity = (z * 0.55).toFixed(3);
      }
    };
    const rest = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      last = 0;
      rect = null;
      Object.assign(target, { x: 0, y: 0, z: 0 });
      Object.assign(now, { x: 0, y: 0, z: 0 });
      el.style.transform = "";
      for (const layer of [...back, ...front, glare, shadow]) {
        layer?.style.removeProperty("translate");
        layer?.style.removeProperty("opacity");
      }
      el.removeAttribute("data-tilting");
    };
    const step = (time: number) => {
      const dt = last ? Math.min(64, time - last) : 16;
      last = time;
      const turn = 1 - Math.exp(-dt / TURN);
      const lift = 1 - Math.exp(-dt / LIFT);
      now.x += (target.x - now.x) * turn;
      now.y += (target.y - now.y) * turn;
      now.z += (target.z - now.z) * lift;
      const settled =
        Math.abs(target.x - now.x) + Math.abs(target.y - now.y) + Math.abs(target.z - now.z) <
        0.001;
      if (settled && target.z === 0) {
        rest();
        return;
      }
      paint();
      frame = settled ? 0 : requestAnimationFrame(step);
      if (!frame) last = 0;
    };
    const kick = () => {
      if (!frame) frame = requestAnimationFrame(step);
    };
    const measure = () => {
      rect = el.getBoundingClientRect();
      back = Array.from(el.querySelectorAll<HTMLElement>(".tilt-back"));
      front = Array.from(el.querySelectorAll<HTMLElement>(".tilt-front"));
    };

    const onEnter = (e: PointerEvent) => {
      if (e.pointerType === "touch" || !enabled()) return;
      if (!frame) measure();
      el.dataset.tilting = "";
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch" || !enabled()) return;
      if (!rect) measure();
      const r = rect!;
      el.dataset.tilting = "";
      target.x = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1));
      target.y = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height) * 2 - 1));
      target.z = 1;
      kick();
    };
    const onLeave = () => {
      Object.assign(target, { x: 0, y: 0, z: 0 });
      if (enabled()) kick();
    };
    // The page moved under the pointer: re-measure on the next move.
    const onScroll = () => {
      if (target.z) rect = null;
    };
    const onPreference = () => {
      if (!enabled()) rest();
    };

    el.addEventListener("pointerenter", onEnter);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    window.addEventListener("scroll", onScroll, { passive: true });
    reduce.addEventListener("change", onPreference);
    fine.addEventListener("change", onPreference);
    return () => {
      rest();
      el.removeEventListener("pointerenter", onEnter);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("scroll", onScroll);
      reduce.removeEventListener("change", onPreference);
      fine.removeEventListener("change", onPreference);
    };
  }, [max]);

  return (
    <div ref={root} className={cn("tilt", className)} {...props}>
      <span className="tilt-shadow" aria-hidden />
      {children}
      <span className="tilt-glare-clip" aria-hidden>
        <span className="tilt-glare" />
      </span>
    </div>
  );
}
