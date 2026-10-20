import {
  HalfFloatType,
  LinearFilter,
  LinearSRGBColorSpace,
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

import {
  createBloomPass,
  halfFloatRenderable,
  type BloomPass,
  type BloomSettings,
} from "./bloom-pass";
import { createCompositePass, type CompositePass } from "./composite-pass";

/**
 * Anti-aliasing for one frame: `fxaa` filters the finished image; `supersample`
 * traces extra rays only at edges (needs `supersample: true` at creation).
 */
export type PassAntialias = "off" | "fxaa" | "supersample";

/** What one frame asks for: its anti-aliasing (default off) and its bloom (default none). */
export type PassFrame = { antialias?: PassAntialias; bloom?: BloomSettings | null };

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
   * How a frame with bloom is finished when the GPU renders into half-float textures: the
   * shader's radiance (`uHdrOutput` 1, before `display`) is drawn into an RGBA16F frame,
   * bloomed in those units, and this full-screen shader writes the display result. It reads
   * the frame as `uImage` (one pixel `uTexel`), the glow as `uBloom` with `uBloomStrength`,
   * and `uniforms` of its own (share the ray shader's where `display` needs them). Without
   * it, or without half-float rendering, bloom works on the display frame instead.
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
  const uniforms = { ...options.uniforms, uHdrOutput: hdrOutput };
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
  /* Bloom on the display frame: the composite is built for the frame's anti-aliasing. */
  const ldrBloom: BloomSettings = {
    strength: 0,
    threshold: 1,
    knee: 0,
    clamp: 1,
    mips: 1,
    scale: 0.5,
  };
  let ldr: { pass: CompositePass; fxaa: boolean } | null = null;
  /* Bloom on radiance: the half-float frame, its glow and the resolve that finishes both. */
  let chain: BloomPass | null = null;
  let radiance: { target: WebGLRenderTarget; scene: Scene; material: ShaderMaterial } | null = null;
  const resolveUniforms = { uBloom: { value: null as unknown }, uBloomStrength: { value: 0 } };
  function radianceFrame() {
    if (radiance || !hdr) return radiance;
    const target = frameTarget(true);
    const resolve = new ShaderMaterial({
      vertexShader: options.vertexShader,
      fragmentShader: hdr.fragmentShader,
      uniforms: {
        ...hdr.uniforms,
        ...resolveUniforms,
        uImage: { value: target.texture },
        uTexel: { value: texel },
      },
      depthTest: false,
      depthWrite: false,
    });
    const quad = new Mesh(geometry, resolve);
    quad.frustumCulled = false;
    const resolveScene = new Scene();
    resolveScene.add(quad);
    radiance = { target, scene: resolveScene, material: resolve };
    return radiance;
  }

  let disposed = false;
  return {
    /** Whether bloom here works on radiance (an RGBA16F frame) rather than on the display frame. */
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
    /** Draws the shader to the canvas, anti-aliased and bloomed as `frame` asks (both default off). */
    render(frame?: PassFrame) {
      if (disposed) return;
      const mode = frame?.antialias ?? "off";
      const bloom = frame?.bloom ?? null;
      const floating = bloom !== null && hdr !== null;
      hdrOutput.value = floating ? 1 : 0;
      if (bloom === null) {
        if (mode === "fxaa") {
          fxaa ??= createCompositePass(renderer, { antialias: "fxaa" });
          fxaa.paint(() => drawRays(mode, false));
        } else drawRays(mode, false);
        return;
      }
      if (!floating) {
        Object.assign(ldrBloom, bloom);
        if (ldr && ldr.fxaa !== (mode === "fxaa")) {
          ldr.pass.dispose();
          ldr = null;
        }
        ldr ??= {
          fxaa: mode === "fxaa",
          pass: createCompositePass(renderer, {
            antialias: mode === "fxaa" ? "fxaa" : "off",
            bloom: ldrBloom,
          }),
        };
        ldr.pass.paint(() => drawRays(mode, false));
        return;
      }
      const hdrFrame = radianceFrame()!;
      renderer.setRenderTarget(hdrFrame.target);
      drawRays(mode, true);
      renderer.setRenderTarget(null);
      chain ??= createBloomPass(renderer);
      resolveUniforms.uBloom.value = chain.render(hdrFrame.target.texture, size.x, size.y, bloom);
      resolveUniforms.uBloomStrength.value = bloom.strength;
      if (mode === "fxaa") {
        fxaa ??= createCompositePass(renderer, { antialias: "fxaa" });
        fxaa.paint(() => renderer.render(hdrFrame.scene, camera));
      } else renderer.render(hdrFrame.scene, camera);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      fxaa?.dispose();
      ldr?.pass.dispose();
      chain?.dispose();
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
}
