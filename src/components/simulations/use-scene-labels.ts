"use client";

import { useMemo } from "react";

import type { Translate } from "@/lib/facts";

/**
 * The words a scene's labels print, by key, from the namespace's `names.*`: every name the
 * scene places and the words its distance labels use. `more` adds what is not a plain name
 * (a template the scene fills); pass a stable function.
 */
export function useSceneLabels<T extends Translate>(
  t: T,
  keys: readonly string[],
  more?: (t: T) => Record<string, string>,
): Record<string, string> {
  return useMemo(
    () => ({
      ...Object.fromEntries(keys.map((key) => [key, t(`names.${key}`)])),
      ...more?.(t),
    }),
    [t, keys, more],
  );
}
