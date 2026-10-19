import {
  LinearSRGBColorSpace,
  Mesh,
  NearestFilter,
  NoToneMapping,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Vector2,
  WebGLRenderTarget,
  WebGLRenderer,
  type IUniform,
} from "three";

import { createFxaaPass, type FxaaPass } from "./fxaa-pass";

/**
 * Anti-aliasing for one frame: `fxaa` filters the finished image; `supersample`
 * traces extra rays only at edges (needs `supersample: true` at creation).
 */
export type PassAntialias = "off" | "fxaa" | "supersample";

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
   * and includes `<horizon/supersample>` for its `main()`; enables
   * `render({ antialias: "supersample" })`.
   */
  supersample?: boolean;
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
  const geometry = new PlaneGeometry(2, 2);
  const material = new ShaderMaterial({
    vertexShader: options.vertexShader,
    fragmentShader: options.fragmentShader,
    uniforms: options.uniforms,
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

  // Post passes exist only once a frame asks for them.
  let fxaa: FxaaPass | null = null;
  let edges: { target: WebGLRenderTarget; material: ShaderMaterial; scene: Scene } | null = null;
  const firstTexel = new Vector2(1, 1);
  function edgePass() {
    if (edges) return edges;
    const target = new WebGLRenderTarget(size.x, size.y, {
      minFilter: NearestFilter,
      magFilter: NearestFilter,
      depthBuffer: false,
      stencilBuffer: false,
    });
    const second = new ShaderMaterial({
      vertexShader: options.vertexShader,
      fragmentShader: options.fragmentShader,
      uniforms: {
        ...options.uniforms,
        uFirstPass: { value: target.texture },
        uFirstTexel: { value: firstTexel },
      },
      defines: { ...options.defines, HORIZON_PASS: "1" },
      depthTest: false,
      depthWrite: false,
    });
    const quad = new Mesh(geometry, second);
    quad.frustumCulled = false;
    const edgeScene = new Scene();
    edgeScene.add(quad);
    edges = { target, material: second, scene: edgeScene };
    return edges;
  }

  let disposed = false;
  return {
    resize(width: number, height: number) {
      renderer.setPixelRatio(1);
      renderer.setSize(width, height, false);
      size.set(width, height);
      firstTexel.set(1 / width, 1 / height);
      edges?.target.setSize(width, height);
    },
    compile() {
      renderer.compile(scene, camera);
    },
    /** Draws the shader to the canvas, optionally anti-aliased (default off). */
    render(frame?: { antialias?: PassAntialias }) {
      if (disposed) return;
      const mode = frame?.antialias ?? "off";
      if (mode === "fxaa") {
        fxaa ??= createFxaaPass(renderer);
        fxaa.render(scene, camera);
        return;
      }
      if (mode === "supersample" && options.supersample) {
        const pass = edgePass();
        renderer.setRenderTarget(pass.target);
        renderer.render(scene, camera);
        renderer.setRenderTarget(null);
        renderer.render(pass.scene, camera);
        return;
      }
      renderer.render(scene, camera);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      fxaa?.dispose();
      edges?.target.dispose();
      edges?.material.dispose();
      material.dispose();
      geometry.dispose();
      renderer.dispose();
    },
  };
}
