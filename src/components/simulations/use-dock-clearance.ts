"use client";

import { useEffect, type RefObject } from "react";

/** Whether the dock is in the way of the panels now, from its box, the stage's and 1 rem. */
export type DockInTheWay = (dock: DOMRect, stage: DOMRect, rem: number) => boolean;

/**
 * Publishes how much of the stage's foot the dock covers, plus a 0.75 rem gap, as
 * `--hud-clear` on the stage (`[data-simulation]`): rails, cards, labels and controls end
 * above it. Where `inTheWay` says the dock clears them, nothing is published and they keep
 * their full height. Rewritten whenever the dock or the stage resizes, and once its entrance
 * animation has carried it into place; pass a stable `inTheWay`. Something else over the
 * stage's foot, such as a caption or a card's sheet, publishes under its own `property`.
 */
export function useDockClearance(
  dock: RefObject<HTMLElement | null>,
  inTheWay?: DockInTheWay,
  property = "--hud-clear",
) {
  useEffect(() => {
    const el = dock.current;
    const stage = el?.closest<HTMLElement>("[data-simulation]");
    if (!el || !stage) return;
    const write = () => {
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      const box = stage.getBoundingClientRect();
      const rect = el.getBoundingClientRect();
      if (rect.height > 0 && (inTheWay?.(rect, box, rem) ?? true))
        stage.style.setProperty(property, `${Math.ceil(box.bottom - rect.top + 0.75 * rem)}px`);
      else stage.style.removeProperty(property);
    };
    const observer = new ResizeObserver(write);
    observer.observe(el);
    observer.observe(stage);
    el.addEventListener("animationend", write);
    return () => {
      observer.disconnect();
      el.removeEventListener("animationend", write);
      stage.style.removeProperty(property);
    };
  }, [dock, inTheWay, property]);
}
