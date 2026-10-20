import type { Camera, Object3D, WebGLRenderer } from "three";

import { createCompositePass } from "./composite-pass";

/**
 * FXAA for any three.js renderer: draws the scene into an offscreen frame of
 * the drawing buffer's size, holding the bytes the canvas would, then onto the
 * canvas through the FXAA shader (`createCompositePass` with `fxaa`). The frame
 * follows the buffer's size on its own. Render into it without hardware MSAA: the
 * canvas's own antialiasing does not apply offscreen, which is the point. Call only
 * on the client; constructing it allocates no GPU memory until the first `render`.
 */
export function createFxaaPass(renderer: WebGLRenderer) {
  const pass = createCompositePass(renderer, { antialias: "fxaa" });

  return {
    target: pass.target,
    /** Renders `scene` from `camera` through FXAA onto the canvas. */
    render(scene: Object3D, camera: Camera) {
      pass.paint(() => renderer.render(scene, camera));
    },
    /** Runs `paint` (any number of renders, e.g. passes over one depth buffer) and filters the result. */
    paint: (paint: () => void) => pass.paint(paint),
    dispose: () => pass.dispose(),
  };
}

export type FxaaPass = ReturnType<typeof createFxaaPass>;
