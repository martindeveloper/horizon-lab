/**
 * `ready`: hardware-accelerated WebGL 2. `software`: WebGL 2 runs on the CPU
 * (SwiftShader, llvmpipe, blocklisted GPU), so expect very low frame rates.
 * `unavailable`: no WebGL 2 context, which Three.js requires.
 */
export type WebGLSupport = "ready" | "software" | "unavailable";

type ProbeCanvas = {
  getContext(type: "webgl2", options?: WebGLContextAttributes): WebGL2RenderingContext | null;
};

const SOFTWARE_RENDERER = /swiftshader|llvmpipe|softpipe|software|basic render driver/i;

function rendererName(gl: WebGL2RenderingContext) {
  const name = String(gl.getParameter(gl.RENDERER) ?? "");
  // Chromium masks RENDERER; Firefox exposes it directly and deprecates the extension.
  if (name && !/^webkit webgl$/i.test(name)) return name;
  const info = gl.getExtension("WEBGL_debug_renderer_info");
  return info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL) ?? name) : name;
}

function release(gl: WebGL2RenderingContext | null) {
  gl?.getExtension("WEBGL_lose_context")?.loseContext();
}

/**
 * Probe WebGL 2 on throwaway canvases and release each context at once. Call
 * only on the client and cache the answer: browsers cap live contexts.
 */
export function probeWebGL(
  createCanvas: () => ProbeCanvas = () => document.createElement("canvas"),
): WebGLSupport {
  let gl: WebGL2RenderingContext | null = null;
  try {
    gl = createCanvas().getContext("webgl2", { failIfMajorPerformanceCaveat: true });
    if (gl) return SOFTWARE_RENDERER.test(rendererName(gl)) ? "software" : "ready";
    gl = createCanvas().getContext("webgl2");
    return gl ? "software" : "unavailable";
  } catch {
    return "unavailable";
  } finally {
    release(gl);
  }
}
