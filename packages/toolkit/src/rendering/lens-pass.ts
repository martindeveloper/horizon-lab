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

import fullscreenVertex from "../shaders/fullscreen.vert.glsl";
import lensSpikeFragment from "../shaders/lens-spike.frag.glsl";
import { halfFloatRenderable, type BloomSettings } from "./bloom-pass";

/**
 * How a frame is finished as a lens would: diffraction spikes on its brightest light and a
 * mild chromatic aberration towards the corners. The spikes are drawn from the bloom chain's
 * bright mask, so their threshold is in that mask's units: display values for an 8-bit
 * frame, radiance for a floating-point one.
 */
export type LensSettings = {
  /**
   * The bright mask the spikes are drawn from when bloom is off: the bloom's own numbers, so
   * the spikes sit on the same light the glow does (`mips` and `strength` are not read).
   * With bloom on, its chain serves.
   */
  mask: BloomSettings;
  /** The chain level the spikes are drawn from: 0 is the prefiltered frame, each level coarser and blurrier. */
  level: number;
  /** Mask brightness (the brightest channel) from which a light spikes in full; dimmer ones in proportion, squared. */
  threshold: number;
  /** A four- or six-point star. */
  arms: 4 | 6;
  /** A spike's length, as a share of the frame's height. */
  reach: number;
  /** Bilinear taps out each way along an arm: the quality's. */
  taps: number;
  /** How much of the spikes is added to the frame. */
  strength: number;
  /** The red and blue channels' offset at the frame's corners, in frame pixels; none at the centre. */
  fringe: number;
};

/** Directions of a star's arms, each running both ways: across and up, or every 60°. */
const DIRECTIONS: Readonly<Record<4 | 6, readonly (readonly [number, number])[]>> = {
  4: [
    [1, 0],
    [0, 1],
  ],
  6: [
    [1, 0],
    [0.5, Math.sqrt(3) / 2],
    [-0.5, Math.sqrt(3) / 2],
  ],
};

/**
 * Diffraction spikes for any bright mask: `render` sums the mask along each arm of a star
 * (two directions for four points, three for six, all in one draw), `taps` taps out each
 * way over `reach` of the frame's height, tapering, and returns the star at the mask's size.
 * The fringe is the resolve shader's (`lens.glsl`); this pass only draws the spikes. One
 * half-float target where the GPU renders into it, bytes otherwise, reallocated when the
 * mask's size changes; one program per star shape and tap count, compiled on first use. Call
 * only on the client.
 */
export function createLensPass(renderer: WebGLRenderer) {
  const floating = halfFloatRenderable(renderer);
  const geometry = new PlaneGeometry(2, 2);
  /* Shared by every program: what changes per frame. */
  const shared = {
    uImage: { value: null as Texture | null },
    uTexel: { value: new Vector2(1, 1) },
    uNorm: { value: 1 },
    uInvThreshold: { value: 1 },
  };
  type Program = { material: ShaderMaterial; steps: Vector2[] };
  const programs = new Map<string, Program>();
  const programFor = (arms: 4 | 6, taps: number) => {
    const key = `${arms}/${taps}`;
    let program = programs.get(key);
    if (program) return program;
    const steps = DIRECTIONS[arms].map(() => new Vector2());
    program = {
      steps,
      material: new ShaderMaterial({
        vertexShader: fullscreenVertex,
        fragmentShader: lensSpikeFragment,
        uniforms: { ...shared, uSteps: { value: steps } },
        defines: { HORIZON_LENS_ARMS: `${arms / 2}`, HORIZON_LENS_TAPS: `${taps}` },
        depthTest: false,
        depthWrite: false,
      }),
    };
    programs.set(key, program);
    return program;
  };
  const quad = new Mesh(geometry);
  quad.frustumCulled = false;
  const scene = new Scene();
  scene.add(quad);
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);

  let target: WebGLRenderTarget | null = null;
  const targetFor = (width: number, height: number) => {
    if (target && target.width === width && target.height === height) return target;
    target?.dispose();
    target = new WebGLRenderTarget(width, height, {
      type: floating ? HalfFloatType : UnsignedByteType,
      minFilter: LinearFilter,
      magFilter: LinearFilter,
      depthBuffer: false,
      stencilBuffer: false,
    });
    target.texture.colorSpace = LinearSRGBColorSpace;
    return target;
  };
  /** The sum of one way's tap weights, by tap count. */
  const sums = new Map<number, number>();
  const weightsOf = (taps: number) => {
    let sum = sums.get(taps);
    if (sum === undefined) {
      sum = 0;
      for (let i = 1; i <= taps; i++) sum += (1 - i / (taps + 1)) ** 2;
      sums.set(taps, sum);
    }
    return sum;
  };

  let disposed = false;
  return {
    /** Draws the star of `mask`, a `width` × `height` texture, and returns it at that size. */
    render(mask: Texture, width: number, height: number, settings: LensSettings): Texture {
      const into = targetFor(width, height);
      const taps = Math.max(1, Math.round(settings.taps));
      const { material, steps } = programFor(settings.arms, taps);
      /* The arm's length in the mask's pixels, split over its taps. */
      const step = (settings.reach * height) / taps;
      DIRECTIONS[settings.arms].forEach(([x, y], i) =>
        steps[i]!.set((x * step) / width, (y * step) / height),
      );
      shared.uTexel.value.set(1 / width, 1 / height);
      shared.uNorm.value = 1 / weightsOf(taps);
      shared.uInvThreshold.value = 1 / Math.max(settings.threshold, 1e-4);
      shared.uImage.value = mask;
      quad.material = material;
      const previous = renderer.getRenderTarget();
      const autoClear = renderer.autoClear;
      renderer.autoClear = false;
      try {
        renderer.setRenderTarget(into);
        renderer.render(scene, camera);
        return into.texture;
      } finally {
        renderer.autoClear = autoClear;
        renderer.setRenderTarget(previous);
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      target?.dispose();
      target = null;
      for (const { material } of programs.values()) material.dispose();
      programs.clear();
      geometry.dispose();
    },
  };
}

export type LensPass = ReturnType<typeof createLensPass>;
