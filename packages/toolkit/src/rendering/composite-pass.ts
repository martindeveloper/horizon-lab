import type { Vector2, WebGLRenderTarget, WebGLRenderer } from "three";

import compositeFragment from "../shaders/composite.frag.glsl";
import { createBloomPass, type BloomPass, type BloomSettings } from "./bloom-pass";
import { createLensPass, type LensPass, type LensSettings } from "./lens-pass";
import { createOffscreenFrame } from "./offscreen-frame";

/** How a composite smooths edges: not at all, 4× hardware multisampling, or FXAA. */
export type CompositeAntialias = "off" | "msaa" | "fxaa";

/**
 * The resolve stage of a scene: `paint` draws into an offscreen frame of the drawing buffer's
 * size, holding the bytes the canvas would, which one full-screen pass then writes onto the
 * canvas, anti-aliased as `antialias` says (`msaa` draws the frame multisampled; `fxaa`
 * filters it), with `lens` with the frame's brightest light spiked and its colours fringed
 * towards the corners (`createLensPass`), and with `bloom` with its bright light blurred and
 * added back (`createBloomPass`), either effect dithered. `bloom` and `lens` are read on every
 * frame, so their numbers may change in place; turning either on or off, or changing
 * `antialias`, takes a new pass. With bloom off, the lens draws its spikes from the mask
 * levels it needs alone. Create the renderer with `antialias: false`. Call only on the client;
 * no GPU memory is allocated until the first `paint`.
 */
export function createCompositePass(
  renderer: WebGLRenderer,
  options: {
    antialias: CompositeAntialias;
    bloom?: BloomSettings | null;
    lens?: LensSettings | null;
  },
) {
  const { antialias, bloom = null, lens = null } = options;
  let chain: BloomPass | null = null;
  let spikes: LensPass | null = null;
  const uniforms = {
    uBloom: { value: null as unknown },
    uBloomStrength: { value: 0 },
    uSpikes: { value: null as unknown },
    uSpikeStrength: { value: 0 },
    uFringe: { value: 0 },
  };
  const before = (target: WebGLRenderTarget, size: Vector2) => {
    chain ??= createBloomPass(renderer);
    if (bloom) {
      uniforms.uBloom.value = chain.render(target.texture, size.x, size.y, bloom);
      uniforms.uBloomStrength.value = bloom.strength;
    }
    if (lens) {
      const mask = bloom
        ? chain.level(lens.level)!
        : chain.mask(target.texture, size.x, size.y, lens.mask, lens.level);
      spikes ??= createLensPass(renderer);
      uniforms.uSpikes.value = spikes.render(mask.texture, mask.width, mask.height, lens);
      uniforms.uSpikeStrength.value = lens.strength;
      uniforms.uFringe.value = lens.fringe;
    }
  };
  const frame = createOffscreenFrame(renderer, {
    fragmentShader: compositeFragment,
    defines: {
      ...(antialias === "fxaa" ? { HORIZON_FXAA: "1" } : {}),
      ...(bloom ? { HORIZON_BLOOM: "1" } : {}),
      ...(lens ? { HORIZON_LENS: "1" } : {}),
    },
    samples: antialias === "msaa" ? 4 : 0,
    uniforms,
    ...(bloom || lens ? { before } : {}),
  });
  return {
    target: frame.target,
    /** Runs `paint` (any number of renders, e.g. passes over one depth buffer) and resolves the result. */
    paint: (paint: () => void) => frame.render(paint),
    dispose() {
      spikes?.dispose();
      chain?.dispose();
      frame.dispose();
    },
  };
}

export type CompositePass = ReturnType<typeof createCompositePass>;
