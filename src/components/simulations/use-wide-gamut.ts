"use client";

import { useSyncExternalStore } from "react";

import { WIDE_GAMUT_QUERY } from "@horizon/toolkit/environment";

const subscribe = (change: () => void) => {
  const query = window.matchMedia(WIDE_GAMUT_QUERY);
  query.addEventListener("change", change);
  return () => query.removeEventListener("change", change);
};

/** Whether this browser's WebGL canvases can show Display P3 (a drawing buffer colour space). */
const webglShowsP3 = () =>
  typeof WebGL2RenderingContext !== "undefined" &&
  "drawingBufferColorSpace" in WebGL2RenderingContext.prototype;

/**
 * Whether the screen shows Display P3, live: wide colour is offered only then. `webgl` asks
 * the browser's WebGL canvases to show it too, for the scenes drawn through one.
 */
export function useWideGamutScreen(webgl = false) {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(WIDE_GAMUT_QUERY).matches && (!webgl || webglShowsP3()),
    () => false,
  );
}
