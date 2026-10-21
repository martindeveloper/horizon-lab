"use client";

import { useSyncExternalStore } from "react";

/**
 * Whether a media query matches, live: the component re-renders when it changes. The server
 * (and the first client render that hydrates it) sees `serverValue`.
 */
export function useMediaQuery(query: string, serverValue = false) {
  return useSyncExternalStore(
    (change) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", change);
      return () => list.removeEventListener("change", change);
    },
    () => window.matchMedia(query).matches,
    () => serverValue,
  );
}
