/** The HUD readouts the engine publishes a few times a second: scale bar, view, drift rate. */
import type { PerspectiveCamera } from "three";

import { createSceneHud } from "@/lib/scene-bridge";
import { SOLAR_VIEWS, solarViewById } from "@/space/solar-system/model/views";
import { movedBy, type Viewport } from "@horizon/toolkit/scene";

import { driftYearsPerSecond } from "../model/views";
import type { useOrrery } from "../store";

const DRIFT_INTERVAL_S = 1;

export function createHud(
  store: typeof useOrrery,
  camera: Pick<PerspectiveCamera, "fov">,
  viewport: Viewport,
) {
  /* World units are au; the bar is a round number in the visitor's unit. */
  const hud = createSceneHud(store, camera, viewport, {
    world: "au",
    views: SOLAR_VIEWS,
    distanceOf: (view) => view.dist,
  });
  let driftClock = 0;
  return {
    /** Writes the readouts on its interval, or at once when forced; only changes reach the store. */
    update(
      dt: number,
      force: boolean,
      view: {
        /** Camera distance from its aim, au. */
        dist: number;
        drift: boolean;
        driftYears: number;
        syncView: boolean;
        /** The camera's orbit angles, radians. */
        angles: { azimuth: number; inclination: number };
      },
    ) {
      driftClock += dt;
      const { dist, syncView } = view;
      hud.update(dt, force, { distance: dist, syncView, angles: view.angles }, (s) => {
        const viewDist = syncView ? dist : solarViewById(s.view).dist;
        const driftRate = view.drift ? driftYearsPerSecond(dist) : 0;
        let driftYears = s.driftYears;
        if (view.driftYears === 0) {
          driftYears = 0;
          driftClock = 0;
        } else if (driftClock >= DRIFT_INTERVAL_S) {
          driftYears = Math.round(view.driftYears * 400) / 400;
          driftClock = 0;
        }
        return {
          moved:
            movedBy(viewDist, s.viewDist, 0.04, 1) ||
            s.driftRate !== driftRate ||
            s.driftYears !== driftYears,
          values: { viewDist, driftRate, driftYears },
        };
      });
    },
  };
}
