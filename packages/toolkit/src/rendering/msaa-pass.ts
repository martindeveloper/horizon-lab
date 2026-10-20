import type { WebGLRenderer } from "three";

import { createCompositePass } from "./composite-pass";

/**
 * Hardware multisampling that can be switched on and off without recreating the
 * renderer: create the renderer with `antialias: false` and draw through this.
 * `paint` renders into a 4× multisampled offscreen frame of the drawing buffer's
 * size, holding the bytes the canvas would, which is then copied onto the
 * canvas (`createCompositePass` with `msaa`). Call only on the client; no GPU
 * memory is allocated until the first `paint`.
 */
export function createMsaaPass(renderer: WebGLRenderer) {
  const pass = createCompositePass(renderer, { antialias: "msaa" });
  return {
    target: pass.target,
    /** Runs `paint` (any number of renders, e.g. passes over one depth buffer) and copies the result. */
    paint: (paint: () => void) => pass.paint(paint),
    dispose: () => pass.dispose(),
  };
}

export type MsaaPass = ReturnType<typeof createMsaaPass>;
