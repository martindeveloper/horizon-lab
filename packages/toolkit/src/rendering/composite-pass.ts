import type { Vector2, WebGLRenderTarget, WebGLRenderer } from "three";

import compositeFragment from "../shaders/composite.frag.glsl";
import { createBloomPass, type BloomPass, type BloomSettings } from "./bloom-pass";
import { createOffscreenFrame } from "./offscreen-frame";

/** How a composite smooths edges: not at all, 4× hardware multisampling, or FXAA. */
export type CompositeAntialias = "off" | "msaa" | "fxaa";

/**
 * The resolve stage of a scene: `paint` draws into an offscreen frame of the drawing buffer's
 * size, holding the bytes the canvas would, which one full-screen pass then writes onto the
 * canvas, anti-aliased as `antialias` says (`msaa` draws the frame multisampled; `fxaa`
 * filters it) and, with `bloom`, with the frame's bright light blurred and added back
 * (`createBloomPass`) and dithered. `bloom` is read on every frame, so its numbers may change
 * in place; turning bloom on or off, or changing `antialias`, takes a new pass. Create the
 * renderer with `antialias: false`. Call only on the client; no GPU memory is allocated until
 * the first `paint`.
 */
export function createCompositePass(
  renderer: WebGLRenderer,
  options: { antialias: CompositeAntialias; bloom?: BloomSettings | null },
) {
  const { antialias, bloom = null } = options;
  let chain: BloomPass | null = null;
  const uniforms = { uBloom: { value: null as unknown }, uBloomStrength: { value: 0 } };
  const frame = createOffscreenFrame(renderer, {
    fragmentShader: compositeFragment,
    defines: {
      ...(antialias === "fxaa" ? { HORIZON_FXAA: "1" } : {}),
      ...(bloom ? { HORIZON_BLOOM: "1" } : {}),
    },
    samples: antialias === "msaa" ? 4 : 0,
    uniforms,
    ...(bloom
      ? {
          before: (target: WebGLRenderTarget, size: Vector2) => {
            chain ??= createBloomPass(renderer);
            uniforms.uBloom.value = chain.render(target.texture, size.x, size.y, bloom);
            uniforms.uBloomStrength.value = bloom.strength;
          },
        }
      : {}),
  });
  return {
    target: frame.target,
    /** Runs `paint` (any number of renders, e.g. passes over one depth buffer) and resolves the result. */
    paint: (paint: () => void) => frame.render(paint),
    dispose() {
      chain?.dispose();
      frame.dispose();
    },
  };
}

export type CompositePass = ReturnType<typeof createCompositePass>;
