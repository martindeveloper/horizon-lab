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

/** The least two fingers are taken to be apart, px: one above the other, they still span a fingertip. */
const PINCH_FLOOR = 8;
/** How far apart two fingers are along the window, px, for a pinch's start and each move alike. */
const pinchSpread = (a: number, b: number) => Math.max(PINCH_FLOOR, Math.abs(a - b));

/**
 * Hover reads a wavelength, a tap picks a line, a mouse drag pans, the wheel zooms, and the
 * arrow keys step through lines (or pan with Shift). A finger has no hover, so on touch one
 * finger scrubs the reading line and two fingers pan and pinch the window. The hover is
 * kept as a fraction of the width, so a zoom under a still cursor reads the new wavelength.
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
  const pinch = useRef<{
    distance: number;
    middle: number;
    range: readonly [number, number];
  } | null>(null);

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
      pinch.current = { distance: pinchSpread(a!, b!), middle: (a! + b!) / 2, range };
      drag.current = null;
      setHoverAt(null);
    } else {
      drag.current = { x: e.clientX, range, moved: false };
      // The line appears under the finger at once, not only once it moves.
      if (e.pointerType === "touch") setHoverAt(fractionAt(e.clientX));
    }
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const touching = pointers.current.has(e.pointerId);
    if (!pinch.current && (e.pointerType !== "touch" || touching)) {
      setHoverAt(fractionAt(e.clientX));
    }
    if (!touching) return;
    pointers.current.set(e.pointerId, e.clientX);
    const rect = surface.current?.getBoundingClientRect();
    if (!rect) return;
    if (pinch.current && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const distance = pinchSpread(a!, b!);
      const [lo, hi] = pinch.current.range;
      // Zoom about the fingers' midpoint, then carry the window with it.
      const centre = lo + ((pinch.current.middle - rect.left) / rect.width) * (hi - lo);
      const factor = pinch.current.distance / distance;
      const shift = (-((a! + b!) / 2 - pinch.current.middle) / rect.width) * (hi - lo) * factor;
      api().setRange([
        centre - (centre - lo) * factor + shift,
        centre + (hi - centre) * factor + shift,
      ]);
    } else if (drag.current) {
      const dx = e.clientX - drag.current.x;
      if (Math.abs(dx) > 4) drag.current.moved = true;
      // One finger scrubs the reading; only a mouse or pen drags the window.
      if (drag.current.moved && e.pointerType !== "touch") {
        const [lo, hi] = drag.current.range;
        const shift = (-dx / rect.width) * (hi - lo);
        api().setRange([lo + shift, hi + shift]);
      }
    }
  };
  /** A pointer lets go; the last one ends the gesture, and `lifted` off a tap it picks a line. */
  const release = (e: ReactPointerEvent<HTMLDivElement>, lifted: boolean) => {
    const wasDrag = drag.current?.moved || gesture.current;
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (pointers.current.size === 0) {
      if (lifted && !wasDrag && identify) {
        api().select(nearest(nmAt(e.clientX))?.line.id ?? null);
      }
      drag.current = null;
      gesture.current = false;
      if (e.pointerType === "touch") setHoverAt(null);
    }
  };
  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => release(e, true);
  /* A touch the system takes away (its own gesture, a call) was never lifted: nothing is picked. */
  const onPointerCancel = (e: ReactPointerEvent<HTMLDivElement>) => release(e, false);
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
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      onPointerLeave,
      onKeyDown,
    },
  };
}
