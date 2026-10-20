import {
  LinearFilter,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  UnsignedByteType,
  Vector2,
  WebGLRenderTarget,
  type WebGLRenderer,
} from "three";

import fullscreenVertex from "../shaders/fullscreen.vert.glsl";

/**
 * A frame drawn offscreen at the drawing buffer's size, holding exactly the bytes the canvas
 * would: materials encode for the renderer's output colour space into it and blend there, as on
 * the canvas, so a scene looks the same through it. 8-bit RGBA, like the canvas: no float
 * buffers needed. A full-screen `fragmentShader` then reads it as `uImage` (one pixel is
 * `uTexel`) and writes its display-ready result straight to the canvas. `samples` above 0
 * multisamples the frame; three.js resolves it after each render into it, as the canvas's own
 * MSAA would. Allocates no GPU memory until the first `render`.
 */
export function createOffscreenFrame(
  renderer: WebGLRenderer,
  options: { fragmentShader: string; defines?: Record<string, string>; samples?: number },
) {
  const size = new Vector2(1, 1);
  const texel = new Vector2(1, 1);
  const target = new WebGLRenderTarget(1, 1, {
    type: UnsignedByteType,
    minFilter: LinearFilter,
    magFilter: LinearFilter,
    depthBuffer: true,
    stencilBuffer: false,
    samples: options.samples ?? 0,
  });
  target.texture.colorSpace = renderer.outputColorSpace;
  /* Plain bytes, never the GPU's sRGB storage: encoded values are stored, blended and sampled
     as they are, with no decode on read. */
  target.texture.internalFormat = "RGBA8";
  /* three.js encodes and tone-maps for the canvas and for an XR target's own colour space, and
     writes linear light into any other target; marked so, this frame gets the canvas's
     programs and output. */
  Object.assign(target, { isXRRenderTarget: true });
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
    /** The offscreen frame. */
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
