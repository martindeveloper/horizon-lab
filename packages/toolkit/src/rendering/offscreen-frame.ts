import {
  HalfFloatType,
  LinearFilter,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  SRGBColorSpace,
  Scene,
  ShaderMaterial,
  UnsignedByteType,
  Vector2,
  WebGLRenderTarget,
  type WebGLRenderer,
} from "three";

import fullscreenVertex from "../shaders/fullscreen.vert.glsl";

/**
 * A frame drawn offscreen at the drawing buffer's size, then onto the canvas through a
 * full-screen `fragmentShader` that reads it as `uImage` (one pixel is `uTexel`). With sRGB
 * output the frame holds linear half floats and the shader encodes them with
 * `linearToOutputTexel`; otherwise it holds display-ready bytes. `samples` above 0
 * multisamples the frame; three.js resolves it after each render into it. Allocates no GPU
 * memory until the first `render`.
 */
export function createOffscreenFrame(
  renderer: WebGLRenderer,
  options: { fragmentShader: string; defines?: Record<string, string>; samples?: number },
) {
  const linear = renderer.outputColorSpace === SRGBColorSpace;
  const size = new Vector2(1, 1);
  const texel = new Vector2(1, 1);
  const target = new WebGLRenderTarget(1, 1, {
    type: linear ? HalfFloatType : UnsignedByteType,
    minFilter: LinearFilter,
    magFilter: LinearFilter,
    depthBuffer: true,
    stencilBuffer: false,
    samples: options.samples ?? 0,
  });
  const geometry = new PlaneGeometry(2, 2);
  const material = new ShaderMaterial({
    vertexShader: fullscreenVertex,
    fragmentShader: options.fragmentShader,
    uniforms: { uImage: { value: target.texture }, uTexel: { value: texel } },
    defines: options.defines ?? {},
    depthTest: false,
    depthWrite: false,
  });
  const quad = new Mesh(geometry, material);
  quad.frustumCulled = false;
  const post = new Scene();
  post.add(quad);
  const postCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  let disposed = false;

  return {
    /** The offscreen frame; bind it to compile materials for linear output. */
    target,
    /**
     * Runs `paint` with the offscreen frame bound, so every render it makes lands there, then
     * draws the frame onto whatever target was bound before (the canvas).
     */
    render: (paint: () => void) => {
      if (disposed) return;
      renderer.getDrawingBufferSize(size);
      if (size.x !== target.width || size.y !== target.height) {
        target.setSize(size.x, size.y);
        texel.set(1 / size.x, 1 / size.y);
      }
      const previous = renderer.getRenderTarget();
      renderer.setRenderTarget(target);
      try {
        paint();
      } finally {
        renderer.setRenderTarget(previous);
      }
      renderer.render(post, postCamera);
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      target.dispose();
      material.dispose();
      geometry.dispose();
    },
  };
}

export type OffscreenFrame = ReturnType<typeof createOffscreenFrame>;
