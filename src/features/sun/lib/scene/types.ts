/**
 * The Sun engine's contract with its host (`bridge.ts`): the hooks it reads the model and the
 * store through, what it publishes a few times a second, and what it offers back.
 */
import type { SceneCamera } from "@/lib/scene-store";
import type { DriftRunState, DriftSettings, DriftShot, OrbitTurn } from "@horizon/toolkit/camera";
import type { SimulationEngine } from "@horizon/toolkit/rendering";
import type { SceneAntialias } from "@horizon/toolkit/scene";

import type { InteriorProfile } from "../graphics/light-tables";
import type { SunPick } from "./picking";
import type { SunViewId } from "./settings";

export type { SunPick };

/** What the engine publishes a few times a second. */
export type SunReadouts = {
  /** The camera's heading and tilt, whole degrees. */
  heading: number;
  tilt: number;
  /** The anti-aliasing drawn with (the device's default while none is chosen). */
  antialias: SceneAntialias;
};

export type SunEngineHooks = {
  /** Runs one frame: the store writes the hooks make inside it are the scene's own (`bridgeStore`). */
  frame?: (draw: () => void) => void;
  /** The interior's profile by radius (0 the centre, 1 the photosphere): the model's Model S. */
  interior: InteriorProfile;
  /** The clock: model seconds per display second, and whether it is held. */
  clock?: () => { rate: number; paused: boolean };
  /** Advances the model by this many model seconds (rate × dt while the clock runs), before the frame is read. */
  advance?: (modelSeconds: number) => void;
  /** The eruption's scrub and whether it plays by itself; while it plays the engine moves it and reports it. */
  eruption?: () => { s: number; playing: boolean };
  onEruption?: (s: number) => void;
  /** A few times a second: the model seconds elapsed, the flare's class (empty: none) and the cycle's phase. */
  publish?: (elapsedSeconds: number, flareClass: string, cyclePhase: number) => void;
  /** A view flight has arrived. */
  landed?: () => void;
  onPick?: (pick: SunPick | null) => void;
  onReadout?: (readouts: SunReadouts) => void;
  /** The first frame is up. */
  onReady?: () => void;
  /** Map detail the view would show is still loading, or no longer. */
  onSharpening?: (sharpening: boolean) => void;
  /** The visitor took the camera (a drag, a wheel, a pinch). */
  onInput?: () => void;
  /** A drift: its shots (read as it begins, so they may be timed to the music), settings and the state it runs in. */
  drift?: {
    shots: () => readonly DriftShot[];
    settings: Partial<DriftSettings>;
    state: () => DriftRunState;
  };
};

export type SunEngine = SimulationEngine & {
  flyToView: (id: SunViewId) => void;
  snapToView: (id: SunViewId) => void;
  /** A button step of the camera. */
  turn: (step: OrbitTurn) => void;
  /** The camera as the store borrows it (`lendCamera`). */
  camera: SceneCamera;
  invalidate: () => void;
  /** The drift has the camera now. */
  driftFlying: () => boolean;
  /** The shot the drift is flying to or holding; −1 before its first and off the drift. */
  driftShot: () => number;
};
