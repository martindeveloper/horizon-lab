import type { StoreApi } from "zustand";

import { nearestView, type OrbitPose, type OrbitTurn } from "@horizon/toolkit/camera";
import type { DisposalScope, RenderQuality } from "@horizon/toolkit/rendering";
import {
  createReadoutClock,
  defaultSceneAntialias,
  scaleChanged,
  scaleReadout,
  type SceneHost,
  type Viewport,
} from "@horizon/toolkit/scene";
import type { DistanceUnit } from "@horizon/toolkit/science";

import { carryPose, takeHandoff, type Crossing, type HandoffSide } from "./handoff";
import type { SceneSlice, SceneStoreState } from "./scene-store";

/**
 * Reads what the HUD publishes on the stage (`[data-simulation]`) under a custom property, CSS
 * px: the dock's height as `--hud-clear` (`useDockClearance`), a caption's as its own. Nothing
 * published, or no stage, reads as `fallback`.
 */
export function stageClearance(host: HTMLElement, property: string, fallback = 0) {
  const stage = host.closest<HTMLElement>("[data-simulation]");
  return () => parseFloat(stage?.style.getPropertyValue(property) ?? "") || fallback;
}

/** A change of the visitor's motion preference redraws the scene, for as long as the scope lives. */
export function invalidateOnMotionChange(
  scope: DisposalScope,
  engine: { invalidate: () => void },
  media: MediaQueryList,
) {
  const onChange = () => engine.invalidate();
  media.addEventListener("change", onChange);
  scope.defer(() => media.removeEventListener("change", onChange));
}

/**
 * The camera's side of a crossing between the Orrery and Deep Field (`handoff.ts`). Arriving,
 * the rig snaps to where `arriveAt` says the other side left off (by default its pose, if it
 * carried one) and flies on to this view; leaving, as the scope is disposed, it carries the
 * pose `leaveAt` gives (null carries none).
 */
export function bridgeHandoff<View>(
  scope: DisposalScope,
  side: HandoffSide,
  rig: {
    limits: () => { min: number; max: number };
    snap: (pose: Partial<OrbitPose>) => void;
    flyToView: (view: View) => void;
  },
  view: View,
  options: {
    arriveAt?: (crossing: Crossing) => Partial<OrbitPose> | null;
    leaveAt: () => OrbitPose | null;
  },
) {
  const crossing = takeHandoff(side, rig.limits());
  if (crossing) {
    const at = options.arriveAt ? options.arriveAt(crossing) : (crossing.pose ?? null);
    if (at) {
      rig.snap(at);
      rig.flyToView(view);
    }
  }
  scope.defer(() => {
    const pose = options.leaveAt();
    if (pose) carryPose(side, pose);
  });
}

/**
 * An engine's side of its store. Each new button turn and each view flight is acted on once;
 * a view the engine writes itself during a frame (the HUD following the zoom) is not, so the
 * camera never flies to where it already is. Every change outside a frame asks for one.
 */
export function bridgeStore<S extends SceneStoreState>(
  store: Pick<StoreApi<S>, "getState" | "subscribe">,
  scope: DisposalScope,
  handlers: {
    invalidate: () => void;
    turn: (turn: OrbitTurn, state: S) => void;
    fly: (state: S) => void;
    /** Any change, before the turn and the flight are acted on. */
    before?: (state: S) => void;
    /** Any change, after them. */
    after?: (state: S) => void;
  },
) {
  let { flight, view, turn } = store.getState();
  let inFrame = false;
  scope.defer(
    store.subscribe((s) => {
      handlers.before?.(s);
      if (s.turn !== turn) {
        turn = s.turn;
        if (s.turn) handlers.turn(s.turn, s);
      }
      if (inFrame) {
        view = s.view;
      } else if (s.flight !== flight || s.view !== view) {
        flight = s.flight;
        view = s.view;
        handlers.fly(s);
      }
      handlers.after?.(s);
      if (!inFrame) handlers.invalidate();
    }),
  );
  return {
    /** Runs one frame: store writes made inside it are the engine's own. */
    frame(draw: () => void) {
      inFrame = true;
      try {
        draw();
      } finally {
        inFrame = false;
      }
    },
    /** The first frame is up: tells the store, once. True that once. */
    ready() {
      const s = store.getState();
      if (s.ready) return false;
      s.setReady(true);
      return true;
    },
  };
}

/** Runs `run` once the browser is idle after painting (a task later where it cannot say). */
function afterPaint(run: () => void) {
  if (typeof requestIdleCallback === "function") {
    const id = requestIdleCallback(run, { timeout: 250 });
    return () => cancelIdleCallback(id);
  }
  const id = setTimeout(run, 0);
  return () => clearTimeout(id);
}

/**
 * The store's render settings drive the engine: `quality` hears the level now, and each later one
 * in the next idle moment (the engine maps it to its settings in `lib/quality.ts`, and may
 * resample whole point clouds, so the control answers first; quick changes arrive as the last).
 * The anti-aliasing reaches the host at once, an unset choice (at first, or after a reset) taking
 * this device's default, published so the settings show it.
 */
export function bridgeRender<S extends Pick<SceneSlice, "antialias" | "setAntialias" | "quality">>(
  store: Pick<StoreApi<S>, "getState" | "subscribe">,
  scope: DisposalScope,
  host: Pick<SceneHost, "tight" | "setAntialias">,
  quality: (level: RenderQuality) => void,
) {
  let level = store.getState().quality;
  quality(level);
  let cancel: (() => void) | null = null;
  scope.defer(() => cancel?.());
  const apply = (s: S) => {
    if (s.quality !== level && cancel === null)
      cancel = afterPaint(() => {
        cancel = null;
        const next = store.getState().quality;
        if (next !== level) quality((level = next));
      });
    if (s.antialias === null) s.setAntialias(defaultSceneAntialias(host.tight));
    else host.setAntialias(s.antialias);
  };
  apply(store.getState());
  scope.defer(store.subscribe(apply));
}

/** A simulation's own readouts: whether any moved enough to publish, and their values. */
type OwnReadouts<S> = { moved: boolean; values: Partial<S> };

/**
 * The HUD readouts an engine publishes a few times a second: the scale bar and, while
 * `syncView` holds (no flight or close-up owns the camera), the view the zoom is nearest.
 * `own` adds the simulation's own readouts. Only news reaches the store.
 */
/** Orbit angles (radians) as the readout shows them: whole degrees, the heading in 0–359. */
function anglesOf({ azimuth, inclination }: { azimuth: number; inclination: number }) {
  const heading = Math.round((azimuth * 180) / Math.PI) % 360;
  return {
    heading: heading < 0 ? heading + 360 : heading,
    tilt: Math.round((inclination * 180) / Math.PI),
  };
}

export function createSceneHud<V extends { id: unknown }, S extends SceneSlice & { view: V["id"] }>(
  store: Pick<StoreApi<S>, "getState" | "setState">,
  camera: { fov: number },
  viewport: Viewport,
  options: {
    /** The unit of the distances `update` is given. */
    world: DistanceUnit;
    views: readonly V[];
    distanceOf: (view: V) => number;
  },
) {
  const due = createReadoutClock();
  return {
    /** Writes the readouts on their interval, or at once when forced. */
    update(
      dt: number,
      force: boolean,
      at: {
        distance: number;
        syncView: boolean;
        /** The camera's orbit angles, radians. */
        angles: { azimuth: number; inclination: number };
      },
      own: (state: S) => OwnReadouts<S>,
    ) {
      if (!due(dt, force)) return;
      const s = store.getState();
      const scale = scaleReadout(camera, viewport, at.distance, options.world, s.distanceUnit);
      const view = at.syncView
        ? nearestView(options.views, options.distanceOf, at.distance).id
        : s.view;
      const { moved, values } = own(s);
      const cameraAngles = anglesOf(at.angles);
      const turned =
        cameraAngles.heading !== s.cameraAngles.heading ||
        cameraAngles.tilt !== s.cameraAngles.tilt;
      if (moved || turned || view !== s.view || scaleChanged(scale, s))
        store.setState({ ...values, ...scale, view, ...(turned ? { cameraAngles } : {}) });
    },
  };
}
