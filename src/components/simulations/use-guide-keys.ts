"use client";

import { useEffect } from "react";

import { isSceneShortcut } from "@horizon/toolkit/ui";

/**
 * The guide's keys on the scene, when no control wants them: Space does what the guide runs
 * (`onSpace`: a step on, a pause), once per press, and the arrows step back and on. Outside the
 * guide the same keys go to `otherwise`. Pass stable handlers, such as ones at module scope
 * reading the store.
 */
export function useGuideKeys<
  S extends { guideOpen: boolean; guideStep: number; goGuide: (step: number) => void },
>(
  getState: () => S,
  handlers: {
    onSpace: (state: S) => void;
    otherwise?: (event: KeyboardEvent, state: S) => void;
  },
) {
  const { onSpace, otherwise } = handlers;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isSceneShortcut(e)) return;
      const api = getState();
      if (!api.guideOpen) {
        otherwise?.(e, api);
        return;
      }
      if (e.key === " ") {
        e.preventDefault();
        if (!e.repeat) onSpace(api);
      } else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        api.goGuide(api.guideStep + (e.key === "ArrowRight" ? 1 : -1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [getState, onSpace, otherwise]);
}
