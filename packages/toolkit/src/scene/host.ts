/**
 * What every zoomable scene starts from: a WebGL renderer sized to its stage, a perspective
 * camera, the stage's CSS size and the frame loop that renders only while something moves
 * (`createEngineHost`). Phones and low-memory devices get a lighter setup (`tight`). Frames
 * are drawn through `render`, anti-aliased as `setAntialias` last chose.
 */
import {
  NoToneMapping,
  PerspectiveCamera,
  SRGBColorSpace,
  WebGLRenderer,
  type Object3D,
  type Scene,
} from "three";

import { COARSE_POINTER_QUERY } from "../environment";
import type { DisposalScope } from "../rendering/disposal";
import { createEngineHost } from "../rendering/engine-host";
import { createFxaaPass, type FxaaPass } from "../rendering/fxaa-pass";
import { createMsaaPass, type MsaaPass } from "../rendering/msaa-pass";
import type { SceneBasics, Viewport } from "./kit";

/** Vertical field of view of the scenes, degrees. */
const SCENE_FOV = 48;

export type SceneHost = ReturnType<typeof createSceneHost>;

/** How a scene smooths its edges: not at all, 4× hardware multisampling, or FXAA. */
export type SceneAntialias = "off" | "msaa" | "fxaa";

/** What a scene draws with until the visitor chooses: MSAA, except on tight devices. */
export function defaultSceneAntialias(tight: boolean): SceneAntialias {
  return tight ? "off" : "msaa";
}

/** How finely a scene is drawn: buffer pixels per CSS pixel at most, and frames per second. */
export type SceneResolution = { dprCap: number; fps: number };

/** What a host draws at until told otherwise: 1.5 px per CSS px, or 1.25 at 48 fps when tight. */
export function defaultSceneResolution(tight: boolean): SceneResolution {
  return tight ? { dprCap: 1.25, fps: 48 } : { dprCap: 1.5, fps: Infinity };
}

/** `SceneBasics` plus the device class and pixel ratio every layer may size itself by. */
export type SceneHostBasics = SceneBasics & {
  /** Phones and low-memory devices: smaller samples and buffers. */
  tight: boolean;
  /**
   * Buffer pixels per CSS pixel, kept current as the resolution changes: share the object as a
   * shader uniform (`{ dpr: basics.dpr }`) so point sizes follow.
   */
  dpr: { value: number };
};

export function createSceneHost(
  scope: DisposalScope,
  options: {
    canvas: HTMLCanvasElement;
    /** The element the canvas fills; its size is the stage's. */
    host: HTMLElement;
    onError: (error: unknown) => void;
    clearColor?: number;
    near?: number;
    far?: number;
  },
) {
  const { canvas, host, onError, clearColor = 0x07080c, near = 0.05, far = 2_000_000 } = options;
  const coarse = window.matchMedia(COARSE_POINTER_QUERY).matches;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  const tight = coarse || (memory != null && memory <= 4);
  let resolution = defaultSceneResolution(tight);
  const dpr = { value: 1 };
  const renderer = new WebGLRenderer({
    canvas,
    /* Anti-aliasing happens offscreen (`setAntialias`), so it can change without a new context. */
    antialias: false,
    powerPreference: "low-power",
    alpha: false,
    stencil: false,
  });
  scope.defer(() => renderer.dispose());
  renderer.toneMapping = NoToneMapping;
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.setClearColor(clearColor, 1);

  const camera = new PerspectiveCamera(SCENE_FOV, 1, near, far);
  const viewport: Viewport = { width: 1, height: 1 };
  const engine = scope.own(
    createEngineHost({
      canvas,
      host,
      resolution: () => ({
        scale: 1,
        dpr: window.devicePixelRatio || 1,
        dprCap: resolution.dprCap,
      }),
      onResize: (w, h) => {
        const rect = host.getBoundingClientRect();
        dpr.value = Math.min(window.devicePixelRatio || 1, resolution.dprCap);
        viewport.width = Math.max(1, rect.width);
        viewport.height = Math.max(1, rect.height);
        renderer.setSize(w, h, false);
        camera.aspect = viewport.width / viewport.height;
        camera.updateProjectionMatrix();
      },
      onError,
    }),
  );

  let antialias = defaultSceneAntialias(tight);
  let pass: MsaaPass | FxaaPass | null = null;
  const passFor = (mode: SceneAntialias) =>
    mode === "msaa" ? createMsaaPass(renderer) : mode === "fxaa" ? createFxaaPass(renderer) : null;
  scope.defer(() => pass?.dispose());

  let warmed = false;
  let alive = true;
  scope.defer(() => {
    alive = false;
  });
  const basics: SceneHostBasics = {
    scope,
    camera,
    viewport,
    tight,
    dpr,
  };

  return {
    renderer,
    camera,
    viewport,
    engine,
    tight,
    basics,
    /** The resolution frames are drawn at; an engine caps its frame rate at `fps`. */
    get resolution() {
      return resolution;
    },
    /** Resizes the buffer for the next frame to `next`'s pixel ratio. */
    setResolution(next: SceneResolution) {
      if (next.dprCap === resolution.dprCap && next.fps === resolution.fps) return;
      resolution = next;
      engine.refresh();
    },
    /** The anti-aliasing frames are drawn with. */
    get antialias() {
      return antialias;
    },
    /** Switches anti-aliasing for the next frame on; the previous mode's buffers are freed. */
    setAntialias(mode: SceneAntialias) {
      if (mode === antialias) return;
      pass?.dispose();
      pass = null;
      antialias = mode;
      engine.invalidate();
    },
    /**
     * Draws one frame: `paint` makes the renders (several may share one depth buffer), into
     * the canvas or an offscreen frame that is anti-aliased onto it.
     */
    render(paint: () => void) {
      pass ??= passFor(antialias);
      if (pass) pass.paint(paint);
      else paint();
    },
    /**
     * Once, in idle time after the first frame: compiles every material in `scene`, hidden
     * objects included, so no zoom, switch or anti-aliasing mode ever waits on a shader. Uses
     * parallel compilation where the browser offers it.
     */
    warmUp: (scene: Scene) => {
      if (warmed) return;
      warmed = true;
      const idle =
        "requestIdleCallback" in window && typeof window.requestIdleCallback === "function"
          ? window.requestIdleCallback.bind(window)
          : (run: () => void) => window.setTimeout(run, 200);
      idle(() => {
        if (!alive) return;
        /* Compiling walks visible objects only; show the hidden ones for that walk alone. */
        const hidden: Object3D[] = [];
        scene.traverse((object) => {
          if (!object.visible) {
            hidden.push(object);
            object.visible = true;
          }
        });
        try {
          renderer.compileAsync(scene, camera).catch(() => undefined);
        } finally {
          for (const object of hidden) object.visible = false;
        }
      });
    },
  };
}
