import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";

import { FULL_RANGE } from "../../lib/model/scenes";
import { useSpectroscopy } from "../../lib/store";
import { nearestVisible, type Visible } from "./labels";

const api = useSpectroscopy.getState;

/**
 * Hover reads a wavelength, a tap picks a line, a drag pans, two fingers or the wheel zoom,
 * and the arrow keys step through lines (or pan with Shift). The hover is kept as a fraction
 * of the width, so a zoom under a still cursor reads the new wavelength.
 */
export function useWindowGestures(input: {
  surface: RefObject<HTMLDivElement | null>;
  range: readonly [number, number];
  width: number;
  visible: readonly Visible[];
  /** Lines may be picked and named. */
  identify: boolean;
  selectedCentre: number | null;
}) {
  const { surface, range, width, visible, identify, selectedCentre } = input;
  const [from, to] = range;
  const span = to - from;
  const [hoverAt, setHoverAt] = useState<number | null>(null);
  const hover = hoverAt === null ? null : from + hoverAt * span;
  const pointers = useRef(new Map<number, number>());
  /** A gesture that has had a second finger is never a tap, until every finger lifts. */
  const gesture = useRef(false);
  const drag = useRef<{ x: number; range: readonly [number, number]; moved: boolean } | null>(null);
  const pinch = useRef<{ distance: number; range: readonly [number, number] } | null>(null);

  const fractionAt = (clientX: number) => {
    const rect = surface.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return 0;
    return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  };
  const nmAt = (clientX: number) => from + fractionAt(clientX) * span;
  const nearest = (nm: number) => nearestVisible(visible, nm, (10 / Math.max(1, width)) * span);

  useEffect(() => {
    const el = surface.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const [a, b] = api().range;
      const about = a + ((e.clientX - rect.left) / rect.width) * (b - a);
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) api().pan(e.deltaX / Math.max(200, rect.width));
      else api().zoom(Math.exp(e.deltaY * 0.0015), about);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [surface]);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, e.clientX);
    if (pointers.current.size === 2) {
      gesture.current = true;
      const [a, b] = [...pointers.current.values()];
      pinch.current = { distance: Math.abs(a! - b!), range };
      drag.current = null;
    } else drag.current = { x: e.clientX, range, moved: false };
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse") setHoverAt(fractionAt(e.clientX));
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, e.clientX);
    const rect = surface.current?.getBoundingClientRect();
    if (!rect) return;
    if (pinch.current && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const distance = Math.max(8, Math.abs(a! - b!));
      const [lo, hi] = pinch.current.range;
      const centre = lo + (((a! + b!) / 2 - rect.left) / rect.width) * (hi - lo);
      const factor = pinch.current.distance / distance;
      api().setRange([centre - (centre - lo) * factor, centre + (hi - centre) * factor]);
    } else if (drag.current) {
      const dx = e.clientX - drag.current.x;
      if (Math.abs(dx) > 4) drag.current.moved = true;
      if (drag.current.moved) {
        const [lo, hi] = drag.current.range;
        const shift = (-dx / rect.width) * (hi - lo);
        api().setRange([lo + shift, hi + shift]);
      }
    }
  };
  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const wasDrag = drag.current?.moved || gesture.current;
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (pointers.current.size === 0) {
      if (!wasDrag && identify) api().select(nearest(nmAt(e.clientX))?.line.id ?? null);
      drag.current = null;
      gesture.current = false;
    }
  };
  const onPointerLeave = () => setHoverAt(null);

  const onKeyDown = (e: ReactKeyboardEvent) => {
    const keys: Record<string, () => void> = {
      "+": () => api().zoom(0.6),
      "=": () => api().zoom(0.6),
      "-": () => api().zoom(1 / 0.6),
      "0": () => api().setRange(FULL_RANGE),
    };
    if (keys[e.key]) {
      e.preventDefault();
      keys[e.key]!();
      return;
    }
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    if (e.shiftKey || !identify || visible.length === 0) {
      api().pan(e.key === "ArrowRight" ? 0.1 : -0.1);
      return;
    }
    const current = selectedCentre ?? (e.key === "ArrowRight" ? from - 1 : to + 1);
    const next =
      e.key === "ArrowRight"
        ? visible.find((v) => v.centre > current + 1e-6)
        : [...visible].reverse().find((v) => v.centre < current - 1e-6);
    if (next) api().select(next.line.id);
  };

  /** The hovered wavelength's line, when lines may be named. */
  const hovered = hover !== null && identify ? nearest(hover) : null;

  return {
    hover,
    hovered,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerLeave, onKeyDown },
  };
}
