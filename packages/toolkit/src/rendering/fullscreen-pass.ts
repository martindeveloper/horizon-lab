import {
  HalfFloatType,
  LinearFilter,
  LinearSRGBColorSpace,
  Matrix3,
  Mesh,
  NearestFilter,
  NoToneMapping,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  UnsignedByteType,
  Vector2,
  WebGLRenderTarget,
  WebGLRenderer,
  type IUniform,
} from "three";

import type { Gamut } from "../science/color";
import {
  createBloomPass,
  halfFloatRenderable,
  type BloomPass,
  type BloomSettings,
} from "./bloom-pass";
import { createCompositePass, type CompositePass } from "./composite-pass";
import { createLensPass, type LensPass, type LensSettings } from "./lens-pass";
import { createOffscreenFrame, type OffscreenFrame } from "./offscreen-frame";
import { gamutMatrix, setDrawingBufferGamut } from "./wide-colour";

/**
 * Anti-aliasing for one frame: `fxaa` filters the finished image; `supersample`
 * traces extra rays only at edges (needs `supersample: true` at creation).
 */
export type PassAntialias = "off" | "fxaa" | "supersample";

/**
 * What one frame asks for: its anti-aliasing (default off), its bloom and its lens (default
 * none) and the gamut the canvas shows (default sRGB).
 */
export type PassFrame = {
  antialias?: PassAntialias;
  bloom?: BloomSettings | null;
  lens?: LensSettings | null;
  gamut?: Gamut;
  /** Apply the optional display-frame filter supplied at creation; bypassed by default. */
  filter?: boolean;
};

/** A single shader pass. Call only on the client; importing this module creates no GPU resources. */
export function createFullscreenPass(options: {
  canvas: HTMLCanvasElement;
  vertexShader: string;
  fragmentShader: string;
  uniforms: Record<string, IUniform>;
  /** Compile-time `#define`s, e.g. from `glslDefines` in `@horizon/toolkit/shaders`. */
  defines?: Record<string, string>;
  clearColor?: number;
  checkShaderErrors?: boolean;
  powerPreference?: WebGLPowerPreference;
  /**
   * The fragment shader defines `vec3 shade(vec2 fragCoord, bool derivatives)`
   * and `vec3 display(vec3 radiance, vec2 fragCoord)`, and includes
   * `<horizon/supersample>` for its `main()`; enables
   * `render({ antialias: "supersample" })`.
   */
  supersample?: boolean;
  /**
   * Optional final display-frame filter, after bloom/lens/FXAA. Reads encoded canvas bytes
   * from `uImage`, with buffer-pixel size `uTexel`. Resources are allocated only when
   * `render({ filter: true })` is first requested. The caller owns the filter's uniforms.
   */
  filter?: {
    fragmentShader: string;
    uniforms: Record<string, IUniform>;
    defines?: Record<string, string>;
  };
  /**
   * How a frame with bloom or a lens is finished when the GPU renders into half-float
   * textures: the shader's radiance (`uHdrOutput` 1, before `display`) is drawn into an
   * RGBA16F frame, bloomed and spiked in those units, and this full-screen shader writes the
   * display result. It reads the frame as `uImage` (one pixel `uTexel`), the glow as `uBloom`
   * with `uBloomStrength`, includes `<horizon/lens>` and applies it under `HORIZON_LENS`
   * (defined while the lens is on), and has `uniforms` of its own (share the ray shader's
   * where `display` needs them). Without it, or without half-float rendering, bloom and the
   * lens work on the display frame instead. Both shaders' `display` multiply linear radiance
   * by `uGamut` (`mat3`, the pass's) before encoding, for a canvas in wide colour.
   */
  hdr?: { fragmentShader: string; uniforms: Record<string, IUniform> };
}) {
  const renderer = new WebGLRenderer({
    canvas: options.canvas,
    antialias: false,
    alpha: false,
    preserveDrawingBuffer: false,
    powerPreference: options.powerPreference ?? "default",
    stencil: false,
    depth: false,
  });
  renderer.debug.checkShaderErrors = options.checkShaderErrors ?? true;
  renderer.setClearColor(options.clearColor ?? 0, 1);
  renderer.outputColorSpace = LinearSRGBColorSpace;
  renderer.toneMapping = NoToneMapping;
  const hdrOutput = { value: 0 };
  /* Linear sRGB to the canvas's primaries: the identity until a frame asks for P3 and the
     canvas takes it, so the shader may apply it always. */
  const gamut = { value: new Matrix3() };
  let gamutAsked: Gamut = "srgb";
  const uniforms = { ...options.uniforms, uHdrOutput: hdrOutput, uGamut: gamut };
  const geometry = new PlaneGeometry(2, 2);
  const material = new ShaderMaterial({
    vertexShader: options.vertexShader,
    fragmentShader: options.fragmentShader,
    uniforms,
    defines: options.defines ?? {},
    depthTest: false,
    depthWrite: false,
  });
  const mesh = new Mesh(geometry, material);
  mesh.frustumCulled = false;
  const scene = new Scene();
  scene.add(mesh);
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const size = new Vector2(1, 1);
  const texel = new Vector2(1, 1);
  const hdr = options.hdr && halfFloatRenderable(renderer) ? options.hdr : null;

  const frameTarget = (floating: boolean) => {
    const target = new WebGLRenderTarget(size.x, size.y, {
      type: floating ? HalfFloatType : UnsignedByteType,
      minFilter: floating ? LinearFilter : NearestFilter,
      magFilter: floating ? LinearFilter : NearestFilter,
      depthBuffer: false,
      stencilBuffer: false,
    });
    target.texture.colorSpace = LinearSRGBColorSpace;
    return target;
  };

  // Post resources exist only once a frame asks for them.
  type EdgePass = { target: WebGLRenderTarget; material: ShaderMaterial; scene: Scene };
  const edges = new Map<boolean, EdgePass>();
  function edgePass(floating: boolean) {
    let pass = edges.get(floating);
    if (pass) return pass;
    const target = frameTarget(floating);
    const second = new ShaderMaterial({
      vertexShader: options.vertexShader,
      fragmentShader: options.fragmentShader,
      uniforms: {
        ...uniforms,
        uFirstPass: { value: target.texture },
        uFirstTexel: { value: texel },
      },
      defines: { ...options.defines, HORIZON_PASS: "1" },
      depthTest: false,
      depthWrite: false,
    });
    const quad = new Mesh(geometry, second);
    quad.frustumCulled = false;
    const edgeScene = new Scene();
    edgeScene.add(quad);
    pass = { target, material: second, scene: edgeScene };
    edges.set(floating, pass);
    return pass;
  }
  /** Draws the ray shader into the bound target: one ray per pixel, with more at edges when asked. */
  function drawRays(mode: PassAntialias, floating: boolean) {
    if (mode === "supersample" && options.supersample) {
      const pass = edgePass(floating);
      const previous = renderer.getRenderTarget();
      renderer.setRenderTarget(pass.target);
      renderer.render(scene, camera);
      renderer.setRenderTarget(previous);
      renderer.render(pass.scene, camera);
      return;
    }
    renderer.render(scene, camera);
  }

  let fxaa: CompositePass | null = null;
  /* Bloom and the lens on the display frame: the composite is built for the frame's
     anti-aliasing and switches; the settings change in place. */
  const ldrBloom: BloomSettings = {
    strength: 0,
    threshold: 1,
    knee: 0,
    clamp: 1,
    mips: 1,
    scale: 0.5,
  };
  const ldrLens: LensSettings = {
    mask: ldrBloom,
    level: 1,
    threshold: 1,
    full: 0,
    arms: 4,
    reach: 0,
    strength: 0,
    fringe: 0,
  };
  /** The byte-frame pass and what it was built for: FXAA, bloom and lens, as bits. */
  let ldr: { pass: CompositePass; key: number } | null = null;
  /* Bloom and the lens on radiance: the half-float frame, its glow and spikes, and the
     resolve that finishes them. */
  let chain: BloomPass | null = null;
  let spikes: LensPass | null = null;
  let radiance: {
    target: WebGLRenderTarget;
    scene: Scene;
    material: ShaderMaterial;
    lens: boolean;
  } | null = null;
  const resolveUniforms = {
    uBloom: { value: null as unknown },
    uBloomStrength: { value: 0 },
    uSpikes: { value: null as unknown },
    uSpikeStrength: { value: 0 },
    uFringe: { value: 0 },
  };
  /** The radiance frame and its resolve, compiled with or without the lens. */
  function radianceFrame(lens: boolean) {
    if (!hdr) return null;
    if (radiance?.lens === lens) return radiance;
    const target = radiance?.target ?? frameTarget(true);
    radiance?.material.dispose();
    const resolve = new ShaderMaterial({
      vertexShader: options.vertexShader,
      fragmentShader: hdr.fragmentShader,
      uniforms: {
        ...hdr.uniforms,
        ...resolveUniforms,
        uGamut: gamut,
        uImage: { value: target.texture },
        uTexel: { value: texel },
      },
      defines: lens ? { HORIZON_LENS: "1" } : {},
      depthTest: false,
      depthWrite: false,
    });
    const quad = new Mesh(geometry, resolve);
    quad.frustumCulled = false;
    const resolveScene = new Scene();
    resolveScene.add(quad);
    radiance = { target, scene: resolveScene, material: resolve, lens };
    return radiance;
  }

  let filtered: OffscreenFrame | null = null;
  let disposed = false;
  const pass = {
    /** Whether bloom and the lens here work on radiance (an RGBA16F frame) rather than on the display frame. */
    hdr: hdr !== null,
    resize(width: number, height: number) {
      renderer.setPixelRatio(1);
      renderer.setSize(width, height, false);
      size.set(width, height);
      texel.set(1 / width, 1 / height);
      for (const pass of edges.values()) pass.target.setSize(width, height);
      radiance?.target.setSize(width, height);
    },
    compile() {
      renderer.compile(scene, camera);
    },
    /**
     * Draws the shader to the canvas, anti-aliased, bloomed and lensed as `frame` asks (all
     * default off), in the gamut it asks (sRGB by default): for P3 the canvas is switched and
     * `uGamut` holds the conversion for the shader's display step.
     */
    render(frame?: PassFrame): void {
      if (disposed) return;
      if (frame?.filter && options.filter) {
        filtered ??= createOffscreenFrame(renderer, { ...options.filter, depthBuffer: false });
        filtered.render(() => pass.render({ ...frame, filter: false }));
        return;
      }
      const mode = frame?.antialias ?? "off";
      const wanted = frame?.gamut ?? "srgb";
      if (wanted !== gamutAsked) {
        gamutAsked = wanted;
        gamutMatrix(setDrawingBufferGamut(renderer, wanted), gamut.value);
      }
      const bloom = frame?.bloom ?? null;
      const lens = frame?.lens ?? null;
      const floating = (bloom !== null || lens !== null) && hdr !== null;
      hdrOutput.value = floating ? 1 : 0;
      if (bloom === null && lens === null) {
        if (mode === "fxaa") {
          fxaa ??= createCompositePass(renderer, { antialias: "fxaa", depthBuffer: false });
          fxaa.paint(() => drawRays(mode, false));
        } else drawRays(mode, false);
        return;
      }
      if (!floating) {
        if (bloom) Object.assign(ldrBloom, bloom);
        if (lens) {
          Object.assign(ldrLens, lens);
          ldrLens.mask = ldrBloom;
        }
        if (lens && !bloom) Object.assign(ldrBloom, lens.mask);
        const key = (mode === "fxaa" ? 1 : 0) | (bloom ? 2 : 0) | (lens ? 4 : 0);
        if (ldr && ldr.key !== key) {
          ldr.pass.dispose();
          ldr = null;
        }
        ldr ??= {
          key,
          pass: createCompositePass(renderer, {
            antialias: mode === "fxaa" ? "fxaa" : "off",
            depthBuffer: false,
            bloom: bloom ? ldrBloom : null,
            lens: lens ? ldrLens : null,
          }),
        };
        ldr.pass.paint(() => drawRays(mode, false));
        return;
      }
      const hdrFrame = radianceFrame(lens !== null)!;
      const previous = renderer.getRenderTarget();
      renderer.setRenderTarget(hdrFrame.target);
      drawRays(mode, true);
      renderer.setRenderTarget(previous);
      chain ??= createBloomPass(renderer);
      const source = hdrFrame.target.texture;
      if (bloom) {
        resolveUniforms.uBloom.value = chain.render(source, size.x, size.y, bloom);
        resolveUniforms.uBloomStrength.value = bloom.strength;
      } else resolveUniforms.uBloomStrength.value = 0;
      if (lens) {
        const levels = chain;
        if (!bloom) levels.mask(source, size.x, size.y, lens.mask, lens.level);
        spikes ??= createLensPass(renderer);
        resolveUniforms.uSpikes.value = spikes.render(
          (i) => levels.level(i)!,
          size.x,
          size.y,
          lens,
        );
        resolveUniforms.uSpikeStrength.value = lens.strength;
        resolveUniforms.uFringe.value = lens.fringe;
      }
      if (mode === "fxaa") {
        fxaa ??= createCompositePass(renderer, { antialias: "fxaa", depthBuffer: false });
        fxaa.paint(() => renderer.render(hdrFrame.scene, camera));
      } else renderer.render(hdrFrame.scene, camera);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      filtered?.dispose();
      fxaa?.dispose();
      ldr?.pass.dispose();
      chain?.dispose();
      spikes?.dispose();
      radiance?.target.dispose();
      radiance?.material.dispose();
      for (const pass of edges.values()) {
        pass.target.dispose();
        pass.material.dispose();
      }
      material.dispose();
      geometry.dispose();
      renderer.dispose();
    },
  };
  return pass;
}
