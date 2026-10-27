import { provideAudioMap } from "@/lib/audio-maps";
import type { DriftProgramme, DriftSlice } from "@/lib/drift";
import type { AudioMap } from "@horizon/toolkit/audio";
import type { BenchFrame, BenchInstance, BenchScene, BenchSurface } from "@horizon/toolkit/bench";
import type { SimulationEngine } from "@horizon/toolkit/rendering";
import type { SceneMount } from "@horizon/toolkit/scene";

/** A space scene's effect switches, as its bench scenes name them. */
type EffectScene = BenchScene & { bloom: boolean; lens: boolean };

/**
 * A space scene's home view as a visitor first sees it, at standard quality, then the same with
 * bloom on and with the lens on. `subject` names what the home view shows.
 */
export function homeScenes(subject: string): EffectScene[] {
  const description = `${subject} (home view), standard quality`;
  return [
    { id: "home", description, tags: ["preset"], bloom: false, lens: false },
    {
      id: "home-bloom",
      description: `${description}, bloom on`,
      tags: ["effects"],
      bloom: true,
      lens: false,
    },
    {
      id: "home-lens",
      description: `${description}, lens on`,
      tags: ["effects"],
      bloom: false,
      lens: true,
    },
  ];
}

/** The engine steps at most a tenth of a second a frame. */
const DRIFT_FRAME_S = 0.1;
/** Keyframes along one loop of a drift. */
const DRIFT_KEYFRAMES = 24;

/** One loop of a drift from the home view, timed to its track's map, its keyframes spread along it. */
export function driftScene(loop: number, description: string): EffectScene & { drift: true } {
  return {
    id: "drift",
    description,
    tags: ["sequence", "camera", "drift"],
    bloom: false,
    lens: false,
    drift: true,
    script: {
      frames: Math.ceil(loop / DRIFT_FRAME_S),
      duration: loop,
      keyframes: Array.from({ length: DRIFT_KEYFRAMES }, (_, i) => i / (DRIFT_KEYFRAMES - 1)),
    },
  };
}

/**
 * The drift as a bench scene mounts it: its track's fixture map provided (none for a still
 * scene), any earlier run stopped and, for a drift scene, started and told it is ready, as the
 * page would once the map has loaded and its loader lifted.
 */
export function benchDrift(
  store: { getState: () => Pick<DriftSlice, "stopDrift" | "startDrift" | "readyDrift"> },
  programme: Pick<DriftProgramme<unknown>, "music">,
  map: AudioMap | null,
  on: boolean | undefined,
) {
  if (programme.music?.track) provideAudioMap(programme.music.track, on ? map : null);
  store.getState().stopDrift();
  if (on) {
    store.getState().startDrift();
    store.getState().readyDrift();
  }
}

/**
 * A zoomable scene's real engine on the bench: the stage, the label layer and the canvas as
 * the page mounts them, with the engine's own frame loop driven by the bench instead of the
 * display. The loop asks the window for animation frames; here that request is kept and
 * answered inside each `render`, so every bench frame is exactly one of the engine's, drawn
 * within the runner's timer. `wake` makes the engine want a frame (a store write its bridge
 * sees), since an idle scene draws nothing. Labels show their keys: they are DOM, outside the
 * canvas the bench captures.
 */
export function mountSceneEngine(
  surface: BenchSurface,
  create: (mount: SceneMount) => SimulationEngine,
  wake: () => void,
): BenchInstance {
  const { canvas, width, height } = surface;
  const host = document.createElement("div");
  host.style.cssText = `position:relative;width:${width}px;height:${height}px;overflow:hidden`;
  const labelRoot = document.createElement("div");
  labelRoot.dataset.sceneLabels = "";
  labelRoot.style.cssText = "position:absolute;inset:0;pointer-events:none";
  canvas.replaceWith(host);
  host.append(canvas, labelRoot);

  const requestFrame = window.requestAnimationFrame;
  const cancelFrame = window.cancelAnimationFrame;
  let pending: FrameRequestCallback | null = null;
  window.requestAnimationFrame = (callback) => {
    pending = callback;
    return 1;
  };
  window.cancelAnimationFrame = () => {
    pending = null;
  };
  const restore = () => {
    window.requestAnimationFrame = requestFrame;
    window.cancelAnimationFrame = cancelFrame;
    host.replaceWith(canvas);
  };

  let engine: SimulationEngine;
  try {
    engine = create({
      canvas,
      host,
      labelRoot,
      labels: () => ({}),
      locale: () => "en",
      onError: (error) => console.warn(error),
    });
  } catch (error) {
    restore();
    throw error;
  }
  const gl = canvas.getContext("webgl2");
  if (!gl) {
    try {
      engine.dispose();
    } finally {
      restore();
    }
    throw new Error("WebGL 2 is unavailable");
  }
  /* The loop's clock: a sequence's simulation time, or a display frame per static frame. */
  let now = 0;
  return {
    gl,
    render(frame: BenchFrame) {
      wake();
      now += frame.dt > 0 ? frame.dt * 1000 : 1000 / 60;
      const tick = pending;
      pending = null;
      tick?.(now);
    },
    dispose() {
      try {
        engine.dispose();
      } finally {
        restore();
      }
    },
  };
}
