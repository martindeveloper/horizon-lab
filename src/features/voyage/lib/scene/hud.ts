/** The HUD readouts the engine publishes a few times a second: the clocks, the range, the light. */
import type { PerspectiveCamera } from "three";

import { createSceneHud } from "@/lib/scene-bridge";
import { movedBy, type Viewport } from "@horizon/toolkit/scene";

import { PLACES } from "../model/places";
import type { Readouts, useVoyage } from "../store";

/** A clock has moved once it shows another second, or a thousandth of itself at large values. */
const ticked = (next: number, now: number) =>
  Math.abs(next - now) >= 0.5 || movedBy(next, now, 1e-3);

export function createHud(
  store: typeof useVoyage,
  camera: Pick<PerspectiveCamera, "fov">,
  viewport: Viewport,
) {
  /* The ship's view never follows the zoom (syncView is false), so no place is matched to a distance. */
  const hud = createSceneHud(store, camera, viewport, {
    world: "au",
    views: PLACES,
    distanceOf: () => 1,
  });
  return {
    /** Writes the readouts on their interval, or at once when forced; only changes reach the store. */
    update(
      dt: number,
      force: boolean,
      at: {
        /** The ship's distance from its aim, km. */
        distance: number;
        angles: { azimuth: number; inclination: number };
      },
      readouts: Readouts,
    ) {
      hud.update(dt, force, { distance: at.distance, syncView: false, angles: at.angles }, (s) => ({
        moved:
          readouts.aim !== s.aim ||
          readouts.flying !== s.flying ||
          readouts.mode !== s.mode ||
          movedBy(readouts.cmbKelvin, s.cmbKelvin, 0.01) ||
          ticked(readouts.shipSeconds, s.shipSeconds) ||
          ticked(readouts.earthSeconds, s.earthSeconds) ||
          movedBy(readouts.speed, s.speed, 0.01) ||
          movedBy(readouts.range, s.range, 0.005) ||
          movedBy(readouts.closing, s.closing, 0.01) ||
          movedBy(readouts.fromSun, s.fromSun, 0.005) ||
          movedBy(readouts.lightToEarth, s.lightToEarth, 0.005) ||
          movedBy(readouts.irradiance, s.irradiance, 0.01),
        values: { ...readouts, shipKm: [...readouts.shipKm] },
      }));
    },
  };
}
