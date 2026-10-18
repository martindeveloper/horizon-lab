/** The HUD readouts the engine publishes a few times a second: view, reach and scale bar. */
import type { PerspectiveCamera } from "three";

import { createSceneHud } from "@/lib/scene-bridge";
import { movedBy, type Viewport } from "@horizon/toolkit/scene";

import { VIEWS } from "../model/views";
import type { useDeepField } from "../store";

export function createHud(
  store: typeof useDeepField,
  camera: Pick<PerspectiveCamera, "fov">,
  viewport: Viewport,
) {
  const hud = createSceneHud(store, camera, viewport, {
    world: "ly",
    views: VIEWS,
    distanceOf: (view) => view.ly,
  });
  /** How far round its centre a view reaches: half the field of view, as a tangent. */
  const spread = () => Math.tan((camera.fov * Math.PI) / 360);
  return {
    /** Writes the readouts on its interval, or at once when forced; only changes reach the store. */
    update(
      dt: number,
      force: boolean,
      view: {
        /** Camera distance from its aim, ly. */
        ly: number;
        /** Its aim's distance from the Sun, ly. */
        aimLy: number;
        syncView: boolean;
      },
    ) {
      const { ly } = view;
      hud.update(dt, force, { distance: ly, syncView: view.syncView }, (s) => {
        const reachLy = view.aimLy + ly * spread();
        return {
          moved: movedBy(ly, s.viewLy, 0.01) || movedBy(reachLy, s.reachLy, 0.01),
          values: { viewLy: ly, reachLy },
        };
      });
    },
  };
}
