"use client";

import { useEffect, useRef, type RefObject } from "react";

/**
 * Focus hand-off for panels and cards that open on demand: on mount, a
 * displayed element takes focus (give it `tabIndex={-1}`); on unmount, focus
 * goes back to whatever had it before, or to `fallback()` when that is gone,
 * but only if focus was inside the element or lost with it. Unmount cleanups
 * run before the next panel mounts, so one panel can hand over to another.
 */
export function useFocusHandoff(
  ref: RefObject<HTMLElement | null>,
  fallback?: () => HTMLElement | null | undefined,
) {
  const back = useRef(fallback);
  useEffect(() => {
    back.current = fallback;
  });
  useEffect(() => {
    const el = ref.current;
    if (!el || el.getClientRects().length === 0) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    el.focus({ preventScroll: true });
    return () => {
      const active = document.activeElement;
      if (active && active !== document.body && !el.contains(active)) return;
      const target =
        previous?.isConnected && previous !== document.body ? previous : back.current?.();
      target?.focus({ preventScroll: true });
    };
  }, [ref]);
}
