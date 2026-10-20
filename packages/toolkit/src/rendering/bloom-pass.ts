import {
  HalfFloatType,
  LinearFilter,
  LinearSRGBColorSpace,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  UnsignedByteType,
  Vector2,
  WebGLRenderTarget,
  type Texture,
  type WebGLRenderer,
} from "three";

import bloomDownFragment from "../shaders/bloom-down.frag.glsl";
import bloomUpFragment from "../shaders/bloom-up.frag.glsl";
import fullscreenVertex from "../shaders/fullscreen.vert.glsl";

/**
 * How a frame blooms. The threshold, knee and clamp are in the frame's own units: display
 * values (0–1) for an 8-bit frame, radiance for a floating-point one.
 */
export type BloomSettings = {
  /** How much of the blurred light is added back to the frame. */
  strength: number;
  /** Brightness (the brightest channel) from which light blooms in full. */
  threshold: number;
  /** How far below the threshold light starts to bloom a little; 0 is a hard cut. */
  knee: number;
  /** A pixel's brightness is capped here before it blooms, so one hot pixel cannot flood the chain. */
  clamp: number;
  /** Levels in the chain, each half the size of the one before: 4 or 5 is usual. */
  mips: number;
  /** The first level's share of the frame's size: 0.5 (half resolution) or 0.25 on tight devices. */
  scale: number;
};

/** Whether this renderer can draw into half-float textures (every modern GPU; some old mobile ones cannot). */
export function halfFloatRenderable(renderer: WebGLRenderer) {
  return (
    renderer.extensions.has("EXT_color_buffer_float") ||
    renderer.extensions.has("EXT_color_buffer_half_float")
  );
}

/**
 * Bloom for any texture (dual Kawase: Bjørge, "Bandwidth-efficient rendering", 2015). `render`
 * takes the frame's bright light down a chain of `mips` levels, the first `scale` of the
 * frame's size, blurring as each halves the one before, then back up, each level's blur added
 * to the next finer one, and returns the first level: the frame's glow, to be added to it
 * `strength` times. Half-float levels where the GPU renders into them, bytes otherwise.
 * Levels are allocated on the first render and reallocated when the frame's size, `mips` or
 * `scale` change. Call only on the client.
 */
export function createBloomPass(renderer: WebGLRenderer) {
  const floating = halfFloatRenderable(renderer);
  const geometry = new PlaneGeometry(2, 2);
  const halfPixel = new Vector2(1, 1);
  const uniforms = {
    uImage: { value: null as Texture | null },
    uLevel: { value: null as Texture | null },
    uHalfPixel: { value: halfPixel },
    uThreshold: { value: 1 },
    uKnee: { value: 0 },
    uClamp: { value: 1 },
  };
  const materialOf = (fragmentShader: string, defines: Record<string, string>) =>
    new ShaderMaterial({
      vertexShader: fullscreenVertex,
      fragmentShader,
      uniforms,
      defines,
      depthTest: false,
      depthWrite: false,
    });
  const prefilter = materialOf(bloomDownFragment, { HORIZON_BLOOM_PREFILTER: "1" });
  const down = materialOf(bloomDownFragment, {});
  const up = materialOf(bloomUpFragment, {});
  const quad = new Mesh(geometry, down);
  quad.frustumCulled = false;
  const scene = new Scene();
  scene.add(quad);
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);

  /** The chain's levels going down, and the sums coming back up at the same sizes. */
  let levels: { down: WebGLRenderTarget[]; up: WebGLRenderTarget[]; key: string } | null = null;
  const targetOf = (width: number, height: number) => {
    const target = new WebGLRenderTarget(width, height, {
      type: floating ? HalfFloatType : UnsignedByteType,
      minFilter: LinearFilter,
      magFilter: LinearFilter,
      depthBuffer: false,
      stencilBuffer: false,
    });
    target.texture.colorSpace = LinearSRGBColorSpace;
    return target;
  };
  const free = () => {
    if (!levels) return;
    for (const target of [...levels.down, ...levels.up]) target.dispose();
    levels = null;
  };
  const chain = (width: number, height: number, settings: BloomSettings) => {
    const mips = Math.max(1, Math.round(settings.mips));
    const key = `${width}x${height}/${mips}@${settings.scale}`;
    if (levels?.key === key) return levels;
    free();
    const sizes = Array.from({ length: mips }, (_, i) => {
      const share = settings.scale / 2 ** i;
      return {
        w: Math.max(1, Math.round(width * share)),
        h: Math.max(1, Math.round(height * share)),
      };
    });
    levels = {
      key,
      down: sizes.map(({ w, h }) => targetOf(w, h)),
      /* The coarsest level needs no sum: the chain turns there. */
      up: sizes.slice(0, -1).map(({ w, h }) => targetOf(w, h)),
    };
    return levels;
  };
  const draw = (material: ShaderMaterial, into: WebGLRenderTarget) => {
    quad.material = material;
    halfPixel.set(0.5 / into.width, 0.5 / into.height);
    renderer.setRenderTarget(into);
    renderer.render(scene, camera);
  };

  let disposed = false;
  return {
    /** Blooms `source`, a `width` × `height` texture, and returns its glow at the chain's first level. */
    render(source: Texture, width: number, height: number, settings: BloomSettings): Texture {
      const { down: downs, up: ups } = chain(width, height, settings);
      const previous = renderer.getRenderTarget();
      const autoClear = renderer.autoClear;
      renderer.autoClear = false;
      try {
        uniforms.uThreshold.value = settings.threshold;
        uniforms.uKnee.value = Math.max(0, settings.knee);
        uniforms.uClamp.value = settings.clamp;
        uniforms.uImage.value = source;
        draw(prefilter, downs[0]!);
        for (let i = 1; i < downs.length; i++) {
          uniforms.uImage.value = downs[i - 1]!.texture;
          draw(down, downs[i]!);
        }
        let finer = downs[downs.length - 1]!;
        for (let i = ups.length - 1; i >= 0; i--) {
          uniforms.uImage.value = finer.texture;
          uniforms.uLevel.value = downs[i]!.texture;
          draw(up, ups[i]!);
          finer = ups[i]!;
        }
        return finer.texture;
      } finally {
        renderer.autoClear = autoClear;
        renderer.setRenderTarget(previous);
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      free();
      prefilter.dispose();
      down.dispose();
      up.dispose();
      geometry.dispose();
    },
  };
}

export type BloomPass = ReturnType<typeof createBloomPass>;
