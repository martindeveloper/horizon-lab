import type { StoreApi } from "zustand";

import { nearestView, type OrbitTurn } from "@horizon/toolkit/camera";
import type { DisposalScope } from "@horizon/toolkit/rendering";
import {
  createReadoutClock,
  scaleChanged,
  scaleReadout,
  type Viewport,
} from "@horizon/toolkit/scene";
import type { DistanceUnit } from "@horizon/toolkit/science";

import type { SceneSlice, SceneStoreState } from "./scene-store";

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

/** A simulation's own readouts: whether any moved enough to publish, and their values. */
export type OwnReadouts<S> = { moved: boolean; values: Partial<S> };

/**
 * The HUD readouts an engine publishes a few times a second: the scale bar and, while
 * `syncView` holds (no flight or close-up owns the camera), the view the zoom is nearest.
 * `own` adds the simulation's own readouts. Only news reaches the store.
 */
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
      at: { distance: number; syncView: boolean },
      own: (state: S) => OwnReadouts<S>,
    ) {
      if (!due(dt, force)) return;
      const s = store.getState();
      const scale = scaleReadout(camera, viewport, at.distance, options.world, s.distanceUnit);
      const view = at.syncView
        ? nearestView(options.views, options.distanceOf, at.distance).id
        : s.view;
      const { moved, values } = own(s);
      if (moved || view !== s.view || scaleChanged(scale, s))
        store.setState({ ...values, ...scale, view });
    },
  };
}
