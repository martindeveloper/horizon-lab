import type { WebGLRenderer } from "three";

import resolveFragment from "../shaders/resolve.frag.glsl";
import { createOffscreenFrame } from "./offscreen-frame";

/**
 * Hardware multisampling that can be switched on and off without recreating the
 * renderer: create the renderer with `antialias: false` and draw through this.
 * `paint` renders into a 4× multisampled offscreen frame of the drawing buffer's
 * size (linear half floats with sRGB output), which is then copied onto the
 * canvas. Call only on the client; no GPU memory is allocated until the first
 * `paint`.
 */
export function createMsaaPass(renderer: WebGLRenderer, samples = 4) {
  const frame = createOffscreenFrame(renderer, { fragmentShader: resolveFragment, samples });
  return {
    target: frame.target,
    /** Runs `paint` (any number of renders, e.g. passes over one depth buffer) and copies the result. */
    paint: frame.render,
    dispose: frame.dispose,
  };
}

export type MsaaPass = ReturnType<typeof createMsaaPass>;
