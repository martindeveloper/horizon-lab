"use client";

import { useEffect } from "react";

import { isSceneShortcut } from "@horizon/toolkit/ui";

/** What Escape may undo: whether it applies now, and how. */
export type EscapeStep = readonly [applies: boolean, undo: () => void];

/**
 * Escape on the scene, from a control too, undoes one thing: the first of `steps()` that
 * applies (a guide, an open panel, a close-up, the selection). Read at each press; pass a
 * stable function, such as one at module scope reading the store.
 */
export function useSceneEscape(steps: () => readonly EscapeStep[]) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || !isSceneShortcut(e, { controls: true })) return;
      steps().find(([applies]) => applies)?.[1]();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [steps]);
}
