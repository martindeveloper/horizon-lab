"use client";

import { WIDE_GAMUT_QUERY } from "@horizon/toolkit/environment";
import { useMediaQuery } from "@horizon/toolkit/ui";

/** Whether this browser's WebGL canvases can show Display P3 (a drawing buffer colour space). */
const webglShowsP3 = () =>
  typeof WebGL2RenderingContext !== "undefined" &&
  "drawingBufferColorSpace" in WebGL2RenderingContext.prototype;

/**
 * Whether the screen shows Display P3, live: wide colour is offered only then. `webgl` asks
 * the browser's WebGL canvases to show it too, for the scenes drawn through one.
 */
export function useWideGamutScreen(webgl = false) {
  return useMediaQuery(WIDE_GAMUT_QUERY) && (!webgl || webglShowsP3());
}
