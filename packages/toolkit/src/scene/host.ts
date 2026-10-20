/**
 * What every zoomable scene starts from: a WebGL renderer sized to its stage, a perspective
 * camera, the stage's CSS size and the frame loop that renders only while something moves
 * (`createEngineHost`). Phones and low-memory devices get a lighter setup (`tight`). Frames
 * are drawn through `render`, anti-aliased as `setAntialias` last chose, bloomed as
 * `setBloom` did and finished as a lens would as `setLens` did.
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
import type { BloomSettings } from "../rendering/bloom-pass";
import { createCompositePass, type CompositePass } from "../rendering/composite-pass";
import type { DisposalScope } from "../rendering/disposal";
import { createEngineHost } from "../rendering/engine-host";
import type { LensSettings } from "../rendering/lens-pass";
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

/**
 * A scene's bloom: whether its bright light glows, and any of the chain's settings to change
 * (`BloomSettings`, in display units: the frame holds the canvas's bytes). What a switch
 * leaves out keeps its value.
 */
export type SceneBloom = Partial<BloomSettings> & { enabled: boolean };

/**
 * What a scene blooms with until told otherwise: light brighter than 0.6 of white, eased in
 * from 0.3, added back at six tenths through a five-level chain from half resolution.
 */
export const DEFAULT_SCENE_BLOOM: Readonly<BloomSettings> = {
  strength: 0.6,
  threshold: 0.6,
  knee: 0.3,
  clamp: 1,
  mips: 5,
  scale: 0.5,
};

/**
 * A scene's lens: whether its brightest light gets diffraction spikes and its corners a
 * colour fringe, and any of the lens's settings to change (`LensSettings` but its mask,
 * which is the scene's bloom). What a switch leaves out keeps its value.
 */
export type SceneLens = Partial<Omit<LensSettings, "mask">> & { enabled: boolean };

/**
 * What a scene's lens does until told otherwise: a four-point star on light whose bloom mask
 * (its first level) is brighter than 0.2, reaching 7 % of the frame's height over ten taps
 * each way, added at eight tenths, and a fringe of 1.5 pixels at the corners.
 */
export const DEFAULT_SCENE_LENS: Readonly<Omit<LensSettings, "mask">> = {
  level: 0,
  threshold: 0.2,
  arms: 4,
  reach: 0.07,
  taps: 10,
  strength: 0.8,
  fringe: 1.5,
};

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
  let bloomOn = false;
  const bloom: BloomSettings = { ...DEFAULT_SCENE_BLOOM };
  let lensOn = false;
  /* The lens's spikes come from the bloom's mask, on or off. */
  const lens: LensSettings = { ...DEFAULT_SCENE_LENS, mask: bloom };
  /* The composite is built for the current anti-aliasing and switches; all off draws
     straight to the canvas. */
  let pass: CompositePass | null = null;
  const passFor = () =>
    antialias === "off" && !bloomOn && !lensOn
      ? null
      : createCompositePass(renderer, {
          antialias,
          bloom: bloomOn ? bloom : null,
          lens: lensOn ? lens : null,
        });
  const rebuild = () => {
    pass?.dispose();
    pass = null;
    engine.invalidate();
  };
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
      antialias = mode;
      rebuild();
    },
    /** Whether frames bloom. */
    get bloom() {
      return bloomOn;
    },
    /**
     * Switches bloom for the next frame on or off and takes the chain's settings given (a
     * quality level's resolution and mip count, a look's strength); off frees its buffers.
     */
    setBloom({ enabled, strength, threshold, knee, clamp, mips, scale }: SceneBloom) {
      bloom.strength = strength ?? bloom.strength;
      bloom.threshold = threshold ?? bloom.threshold;
      bloom.knee = knee ?? bloom.knee;
      bloom.clamp = clamp ?? bloom.clamp;
      bloom.mips = mips ?? bloom.mips;
      bloom.scale = scale ?? bloom.scale;
      if (enabled !== bloomOn) {
        bloomOn = enabled;
        rebuild();
      } else if (bloomOn || lensOn) engine.invalidate();
    },
    /** Whether frames are finished as a lens would. */
    get lens() {
      return lensOn;
    },
    /**
     * Switches the lens for the next frame on or off and takes the settings given (a quality
     * level's reach and taps, a look's strength); off frees its buffers.
     */
    setLens({ enabled, level, threshold, arms, reach, taps, strength, fringe }: SceneLens) {
      lens.level = level ?? lens.level;
      lens.threshold = threshold ?? lens.threshold;
      lens.arms = arms ?? lens.arms;
      lens.reach = reach ?? lens.reach;
      lens.taps = taps ?? lens.taps;
      lens.strength = strength ?? lens.strength;
      lens.fringe = fringe ?? lens.fringe;
      if (enabled !== lensOn) {
        lensOn = enabled;
        rebuild();
      } else if (lensOn) engine.invalidate();
    },
    /**
     * Draws one frame: `paint` makes the renders (several may share one depth buffer), into
     * the canvas or an offscreen frame that is anti-aliased, bloomed and lensed onto it. Only
     * what `paint` draws takes part: DOM labels and readouts sit above the canvas, so text
     * never blooms, spikes or fringes.
     */
    render(paint: () => void) {
      pass ??= passFor();
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
