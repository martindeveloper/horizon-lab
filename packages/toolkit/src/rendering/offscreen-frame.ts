import {
  HalfFloatType,
  LinearFilter,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  UnsignedByteType,
  Vector2,
  WebGLRenderTarget,
  type IUniform,
  type WebGLRenderer,
} from "three";

import fullscreenVertex from "../shaders/fullscreen.vert.glsl";

/**
 * A frame drawn offscreen at the drawing buffer's size, holding exactly the bytes the canvas
 * would: materials encode for the renderer's output colour space into it and blend there, as on
 * the canvas, so a scene looks the same through it. 8-bit RGBA, like the canvas, unless
 * `floating`: then half-float, holding the same encoding but keeping light past white, which
 * the canvas would clip, for the full-screen shader to finish (the GPU must render into
 * half-float textures, `halfFloatRenderable`). A full-screen `fragmentShader` then reads it
 * as `uImage` (one pixel is `uTexel`), with any `uniforms` of its own, and writes its
 * display-ready result straight to the canvas. `samples` above 0 multisamples the frame; three.js resolves it after each render
 * into it, as the canvas's own MSAA would. `before(target, size)` runs once the frame is drawn
 * and resolved, before the full-screen shader reads it: a place to derive other textures from
 * it. Allocates no GPU memory until the first `render`.
 */
export function createOffscreenFrame(
  renderer: WebGLRenderer,
  options: {
    fragmentShader: string;
    defines?: Record<string, string>;
    samples?: number;
    /** Half-float storage that keeps light past white; 8-bit by default. */
    floating?: boolean;
    /** Full-screen image filters need no depth attachment. Scene composites default to one. */
    depthBuffer?: boolean;
    uniforms?: Record<string, IUniform>;
    before?: (target: WebGLRenderTarget, size: Vector2) => void;
  },
) {
  const size = new Vector2(1, 1);
  const texel = new Vector2(1, 1);
  const target = new WebGLRenderTarget(1, 1, {
    type: options.floating ? HalfFloatType : UnsignedByteType,
    minFilter: LinearFilter,
    magFilter: LinearFilter,
    depthBuffer: options.depthBuffer ?? true,
    stencilBuffer: false,
    samples: options.samples ?? 0,
  });
  target.texture.colorSpace = renderer.outputColorSpace;
  /* Never the GPU's sRGB storage: encoded values are stored, blended and sampled as they are,
     with no decode on read. */
  target.texture.internalFormat = options.floating ? "RGBA16F" : "RGBA8";
  /* three.js encodes and tone-maps for the canvas and for an XR target's own colour space, and
     writes linear light into any other target; marked so, this frame gets the canvas's
     programs and output. */
  Object.assign(target, { isXRRenderTarget: true });
  const geometry = new PlaneGeometry(2, 2);
  const material = new ShaderMaterial({
    vertexShader: fullscreenVertex,
    fragmentShader: options.fragmentShader,
    uniforms: {
      ...options.uniforms,
      uImage: { value: target.texture },
      uTexel: { value: texel },
    },
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
      options.before?.(target, size);
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
