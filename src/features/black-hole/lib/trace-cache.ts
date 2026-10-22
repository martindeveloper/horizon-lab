import {
  GLSL3,
  Mesh,
  NearestFilter,
  OrthographicCamera,
  PlaneGeometry,
  RGBAIntegerFormat,
  Scene,
  ShaderMaterial,
  UnsignedIntType,
  WebGLRenderTarget,
  type WebGLRenderer,
} from "three";

import { fullscreenVertex } from "@horizon/toolkit/shaders";

import fragmentShader from "./black-hole.frag.glsl";
import { traceKeyWriter, type Uniforms } from "./frame";
import { TRACE_TARGETS } from "./parameters";

const sameKey = (a: readonly number[], b: readonly number[]) =>
  a.length === b.length && a.every((value, i) => value === b[i]);

/**
 * The black hole's march, kept while only the clock and the camera's azimuth change.
 *
 * The shader marches with the camera turned to azimuth zero (frame.ts), so an orbit that only
 * turns traces the same rays every frame. The trace pass (`KERR_TRACE`) writes each pixel's
 * record into four RGBA32UI targets, raw float bits; the shading pass (`KERR_REPLAY`) then
 * evaluates only what moves: the disk's gas, hot spot and plunging glow at the crossings'
 * azimuths turned by `uAzimuth`, and the sky in the turned direction. Integer targets keep
 * every float exact and render on every WebGL 2 device, unlike float ones.
 *
 * `prepare` decides each frame, before the shading pass draws. Inputs that differ from the
 * previous frame's (`traceKeyWriter`: the camera moving in distance or height, a slider dragged, a
 * resize) mean the camera is moving: that frame marches in one pass as before, at no extra
 * cost. Once they hold for a frame, it is traced into the record and replayed until they
 * change. A frame larger than the caller's cap (`recordPixels` in quality.ts) always marches, and a
 * cap of 0 marches every frame.
 *
 * The trace pass is compiled only once a record is first wanted: compiling it slows the frames
 * drawn meanwhile, which a camera that never holds still would pay for nothing. With `parallel`
 * it compiles in the background (KHR_parallel_shader_compile) and frames march until it is
 * ready, for a page that must not stall; without, it compiles in the frame that wants it, for
 * the bench, whose frames follow one another without yielding.
 */
export function createTraceCache(uniforms: Uniforms, { parallel }: { parallel: boolean }) {
  const record = new WebGLRenderTarget(1, 1, {
    count: TRACE_TARGETS,
    format: RGBAIntegerFormat,
    type: UnsignedIntType,
    minFilter: NearestFilter,
    magFilter: NearestFilter,
    generateMipmaps: false,
    depthBuffer: false,
    stencilBuffer: false,
  });
  const replay = { value: 0 };
  const material = new ShaderMaterial({
    glslVersion: GLSL3,
    vertexShader: fullscreenVertex,
    fragmentShader,
    uniforms,
    defines: { KERR_TRACE: "1" },
    depthTest: false,
    depthWrite: false,
  });
  const geometry = new PlaneGeometry(2, 2);
  const quad = new Mesh(geometry, material);
  quad.frustumCulled = false;
  const scene = new Scene();
  scene.add(quad);
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const traceKey = traceKeyWriter(uniforms);

  let compiling = false;
  let ready = false;
  /** The inputs the record was traced with, while it holds one. */
  let traced: number[] | null = null;
  let previous: number[] = [];
  let current: number[] = [];

  /** Draws the trace pass into the record at the frame's size. */
  function trace(renderer: WebGLRenderer, width: number, height: number) {
    record.setSize(width, height);
    const target = renderer.getRenderTarget();
    const autoClear = renderer.autoClear;
    /* Every pixel is written; integer targets would only be cleared for nothing. */
    renderer.autoClear = false;
    renderer.setRenderTarget(record);
    renderer.render(scene, camera);
    renderer.setRenderTarget(target);
    renderer.autoClear = autoClear;
  }

  /** Compiles the trace pass with the record bound as it draws, so its program is the one used. */
  function compile(renderer: WebGLRenderer) {
    compiling = true;
    const target = renderer.getRenderTarget();
    renderer.setRenderTarget(record);
    if (parallel) {
      void renderer.compileAsync(scene, camera).then(() => {
        ready = true;
      });
    } else {
      renderer.compile(scene, camera);
      ready = true;
    }
    renderer.setRenderTarget(target);
  }

  return {
    /** For the shading pass: its define, and the record and switch it reads. */
    defines: { KERR_REPLAY: "1" },
    uniforms: {
      uReplay: replay,
      ...Object.fromEntries(
        record.textures.map((texture, i) => [`uTrace${i}`, { value: texture }]),
      ),
    },
    /**
     * Before the shading pass draws: traces into the record when it must, and sets `uReplay`.
     * `maxPixels` is the largest frame the record may cover.
     */
    prepare(renderer: WebGLRenderer, maxPixels: number) {
      const { x: width, y: height } = uniforms.uResolution.value;
      const fits = width * height <= maxPixels;
      if (!fits) {
        record.setSize(1, 1);
        traced = null;
      }
      /* The shading pass samples the record whether or not it replays it. */
      renderer.initRenderTarget(record);
      [previous, current] = [current, previous];
      traceKey(current);
      if (traced && sameKey(current, traced)) {
        replay.value = 1;
        return;
      }
      traced = null;
      replay.value = 0;
      if (!fits || !sameKey(current, previous)) return;
      if (!compiling) compile(renderer);
      if (!ready) return;
      trace(renderer, width, height);
      traced = [...current];
      replay.value = 1;
    },
    /** Forgets the record: after a lost context, the GPU no longer holds it. */
    invalidate() {
      traced = null;
    },
    dispose() {
      record.dispose();
      material.dispose();
      geometry.dispose();
    },
  };
}
