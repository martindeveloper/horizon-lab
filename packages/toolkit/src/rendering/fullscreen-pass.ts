import {
  LinearSRGBColorSpace,
  Mesh,
  NoToneMapping,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  WebGLRenderer,
  type IUniform,
} from "three";

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
  let disposed = false;
  return {
    resize(width: number, height: number) {
      renderer.setPixelRatio(1);
      renderer.setSize(width, height, false);
    },
    compile() {
      renderer.compile(scene, camera);
    },
    render() {
      if (!disposed) renderer.render(scene, camera);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      material.dispose();
      geometry.dispose();
      renderer.dispose();
    },
  };
}
