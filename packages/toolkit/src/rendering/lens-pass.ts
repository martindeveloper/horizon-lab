import {
  AdditiveBlending,
  Color,
  HalfFloatType,
  InstancedBufferGeometry,
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

import lensStarFragment from "../shaders/lens-star.frag.glsl";
import lensStarVertex from "../shaders/lens-star.vert.glsl";
import { halfFloatRenderable, type BloomLevel, type BloomSettings } from "./bloom-pass";

/**
 * How a frame is finished as a telescope would: diffraction spikes on its brightest compact
 * lights and a mild chromatic aberration towards the corners. The lights are found in the
 * bloom chain's bright mask, so the threshold is in the frame's units: display values for an
 * 8-bit frame, radiance for a floating-point one.
 */
export type LensSettings = {
  /**
   * The bright mask the lights are found in when bloom is off: the bloom's own numbers, so the
   * spikes sit on the same light the glow does (`mips` and `strength` are not read). With
   * bloom on, its chain serves.
   */
  mask: BloomSettings;
  /**
   * The chain level lights are found in, each of its texels a cell of the frame (0 is the
   * prefiltered frame; each level halves it): a light about a cell or two wide spikes, a wider
   * one does not. The quality's, with the chain's `scale`: about a thirty-second of the frame.
   */
  level: number;
  /** The faintest light a spike is drawn to: a brighter light's spikes reach further. */
  threshold: number;
  /**
   * The energy (frame pixels of light above the mask's threshold) from which a light spikes in
   * full; a fainter one spikes as the cube of its share. An 8-bit frame clips every bright light
   * to white, so only the dominant ones should carry stars there; 0 spikes every light in full,
   * for a radiance frame that knows how bright each is.
   */
  full: number;
  /** A four-point star (two vanes across, as Hubble's spider) or six (as JWST's struts). */
  arms: 4 | 6;
  /** A spike's greatest length, as a share of the frame's height. */
  reach: number;
  /** How much of a light the spikes carry, added to the frame. */
  strength: number;
  /** The red and blue channels' offset at the frame's corners, in frame pixels; none at the centre. */
  fringe: number;
};

/** A line's Gaussian width and a spike's core, frame pixels: a vane's diffraction is thin. */
const LINE_WIDTH = 0.8;
const SPIKE_CORE = 2.5;
/** The star target's share of the frame: lines are box-filtered over its texels. */
const STAR_SCALE = 0.5;
/** Levels between the one lights are found in and the one they are placed by. */
const FINE_STEPS = 2;

/**
 * Diffraction spikes for a frame's bright light: `render` finds the compact lights in a
 * level of the bloom chain (`levelOf`, after a `render` or `mask` of it), measures each one
 * through a Gaussian window centred on the light itself in a finer level, so its star holds
 * steady as it or a neighbour moves, and draws the star as thin lines through its centre,
 * brightness falling as 1/r² and red reaching furthest, into a target at half the frame's
 * size, to be added `strength` times. One instanced draw:
 * an instance per cell and line, all but the lights' collapsing in their vertex shader, so
 * the fill is the lines' pixels alone. The fringe is the resolve shader's (`lens.glsl`). One
 * half-float target where the GPU renders into it, bytes otherwise, reallocated when the
 * frame's size changes. Call only on the client.
 */
export function createLensPass(renderer: WebGLRenderer) {
  const floating = halfFloatRenderable(renderer);
  const plane = new PlaneGeometry(2, 2);
  const geometry = new InstancedBufferGeometry();
  geometry.setIndex(plane.getIndex());
  geometry.setAttribute("position", plane.getAttribute("position"));
  const uniforms = {
    uCells: { value: null as Texture | null },
    uFine: { value: null as Texture | null },
    uFrame: { value: new Vector2(1, 1) },
    uCellArea: { value: 1 },
    uFineArea: { value: 1 },
    uAxes: { value: 2 },
    uReach: { value: 1 },
    uThreshold: { value: 1 },
    uStrength: { value: 1 },
    uFull: { value: 0 },
    uWidth: { value: LINE_WIDTH },
    uCore: { value: SPIKE_CORE },
    uTexelFrame: { value: 1 / STAR_SCALE },
  };
  const material = new ShaderMaterial({
    vertexShader: lensStarVertex,
    fragmentShader: lensStarFragment,
    uniforms,
    blending: AdditiveBlending,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const lines = new Mesh(geometry, material);
  lines.frustumCulled = false;
  const scene = new Scene();
  scene.add(lines);
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const clear = new Color();

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

  let disposed = false;
  return {
    /**
     * Draws the stars of a `width` × `height` frame's lights, found in level `settings.level`
     * of its bloom chain (`levelOf` reads a level of the chain's last render or mask), and
     * returns them at half the frame's size.
     */
    render(
      levelOf: (index: number) => BloomLevel,
      width: number,
      height: number,
      settings: LensSettings,
    ): Texture {
      const cells = levelOf(settings.level);
      const fine = levelOf(Math.max(0, settings.level - FINE_STEPS));
      const into = targetFor(
        Math.max(1, Math.round(width * STAR_SCALE)),
        Math.max(1, Math.round(height * STAR_SCALE)),
      );
      const axes = settings.arms / 2;
      uniforms.uCells.value = cells.texture;
      uniforms.uFine.value = fine.texture;
      uniforms.uFrame.value.set(width, height);
      uniforms.uCellArea.value = (width / cells.width) * (height / cells.height);
      uniforms.uFineArea.value = (width / fine.width) * (height / fine.height);
      uniforms.uAxes.value = axes;
      uniforms.uReach.value = settings.reach * height;
      uniforms.uThreshold.value = Math.max(settings.threshold, 1e-6);
      uniforms.uStrength.value = settings.strength;
      uniforms.uFull.value = Math.max(0, settings.full);
      uniforms.uTexelFrame.value = width / into.width;
      geometry.instanceCount = cells.width * cells.height * axes;
      const previous = renderer.getRenderTarget();
      const autoClear = renderer.autoClear;
      renderer.getClearColor(clear);
      const alpha = renderer.getClearAlpha();
      renderer.autoClear = false;
      try {
        renderer.setRenderTarget(into);
        renderer.setClearColor(0x000000, 0);
        renderer.clear(true, false, false);
        renderer.render(scene, camera);
        return into.texture;
      } finally {
        renderer.setClearColor(clear, alpha);
        renderer.autoClear = autoClear;
        renderer.setRenderTarget(previous);
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      target?.dispose();
      target = null;
      material.dispose();
      geometry.dispose();
      plane.dispose();
    },
  };
}

export type LensPass = ReturnType<typeof createLensPass>;
