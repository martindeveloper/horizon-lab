/**
 * A dissolve between two states of the canvas: the frame as it stands is kept, and drawn
 * over the frames that follow while it fades, so a change that redraws everything at once
 * (another light) reads as one picture giving way to the next. Nothing is allocated, and no
 * draw is made, while no dissolve runs.
 */
import {
  FramebufferTexture,
  Mesh,
  NormalBlending,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Vector2,
  type WebGLRenderer,
} from "three";

import type { DisposalScope } from "@horizon/toolkit/rendering";

const VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

/* The kept frame is already display-encoded: it is drawn back as it was, only fainter. */
const FRAGMENT = /* glsl */ `
precision highp float;
uniform sampler2D uImage;
uniform float uAlpha;
varying vec2 vUv;
void main() {
  gl_FragColor = vec4(texture2D(uImage, vUv).rgb, uAlpha);
}
`;

export function createDissolve(scope: DisposalScope, renderer: WebGLRenderer, seconds: number) {
  const size = new Vector2();
  let kept: FramebufferTexture | null = null;
  /** Seconds the fade has left; 0 while none runs. */
  let left = 0;
  const uniforms = { uImage: { value: null as FramebufferTexture | null }, uAlpha: { value: 0 } };
  const material = new ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms,
    transparent: true,
    blending: NormalBlending,
    depthTest: false,
    depthWrite: false,
  });
  const mesh = new Mesh(new PlaneGeometry(2, 2), material);
  mesh.frustumCulled = false;
  const scene = new Scene();
  scene.add(mesh);
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  scope.defer(() => {
    kept?.dispose();
    material.dispose();
    mesh.geometry.dispose();
  });

  return {
    /** A dissolve is under way. */
    get active() {
      return left > 0;
    },
    /** Keeps the canvas as it stands: call right after a frame is drawn, before what changes it is applied. */
    capture() {
      renderer.getDrawingBufferSize(size);
      if (!kept || kept.image.width !== size.x || kept.image.height !== size.y) {
        kept?.dispose();
        kept = new FramebufferTexture(size.x, size.y);
      }
      const previous = renderer.getRenderTarget();
      renderer.setRenderTarget(null);
      renderer.copyFramebufferToTexture(kept);
      renderer.setRenderTarget(previous);
      uniforms.uImage.value = kept;
      left = seconds;
    },
    /** Draws the kept frame over the canvas, fading with the time passed; call after each frame is drawn. */
    draw(dt: number) {
      if (left <= 0 || !kept) return;
      left = Math.max(0, left - dt);
      /* The kept frame's size is the canvas's unless the stage was resized mid-fade. */
      renderer.getDrawingBufferSize(size);
      if (kept.image.width !== size.x || kept.image.height !== size.y) {
        left = 0;
        return;
      }
      const share = left / seconds;
      uniforms.uAlpha.value = share * share;
      const previous = renderer.getRenderTarget();
      const autoClear = renderer.autoClear;
      renderer.setRenderTarget(null);
      renderer.autoClear = false;
      renderer.render(scene, camera);
      renderer.autoClear = autoClear;
      renderer.setRenderTarget(previous);
    },
  };
}
