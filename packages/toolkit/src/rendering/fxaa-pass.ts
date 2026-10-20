import type { Camera, Object3D, WebGLRenderer } from "three";

import fxaaFragment from "../shaders/fxaa.frag.glsl";
import { createOffscreenFrame } from "./offscreen-frame";

/**
 * FXAA for any three.js renderer: draws the scene into an offscreen frame of
 * the drawing buffer's size, holding the bytes the canvas would, then onto the
 * canvas through the FXAA shader. The frame follows the buffer's size on its
 * own. Render into it without hardware MSAA: the canvas's own antialiasing does
 * not apply offscreen, which is the point. Call only on the client;
 * constructing it allocates no GPU memory until the first `render`.
 */
export function createFxaaPass(renderer: WebGLRenderer) {
  const frame = createOffscreenFrame(renderer, { fragmentShader: fxaaFragment });

  return {
    target: frame.target,
    /** Renders `scene` from `camera` through FXAA onto the canvas. */
    render(scene: Object3D, camera: Camera) {
      frame.render(() => renderer.render(scene, camera));
    },
    /** Runs `paint` (any number of renders, e.g. passes over one depth buffer) and filters the result. */
    paint: frame.render,
    dispose: frame.dispose,
  };
}

export type FxaaPass = ReturnType<typeof createFxaaPass>;
