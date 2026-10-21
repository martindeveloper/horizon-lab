/** The HUD readouts the engine publishes a few times a second: the clocks, the range, the light. */
import type { PerspectiveCamera } from "three";

import { createSceneHud } from "@/lib/scene-bridge";
import { movedBy, type Vec3d, type Viewport } from "@horizon/toolkit/scene";

import { VIEW_IDS } from "../model/view-ids";
import type { Readouts, VoyageStore, useVoyage } from "../store";

/** A clock has moved once it shows another second, or a thousandth of itself at large values. */
const ticked = (next: number, now: number) =>
  Math.abs(next - now) >= 0.5 || movedBy(next, now, 1e-3);

/** Seconds between the ship's fixes: the lists and cards measure trips from the last one. */
const FIX_S = 1;

/* The ship's view never follows the zoom (syncView is false), so no place is matched to a distance. */
const VIEWS = VIEW_IDS.map((id) => ({ id }));

export function createHud(
  store: typeof useVoyage,
  camera: Pick<PerspectiveCamera, "fov">,
  viewport: Viewport,
) {
  const hud = createSceneHud(store, camera, viewport, {
    world: "au",
    views: VIEWS,
    distanceOf: () => 1,
  });
  let sinceFix = Infinity;
  return {
    /**
     * Publishes the readouts on their interval, or at once when forced (the store changed):
     * `read` fills them only then, and only changes reach the store. The ship's fix goes with
     * them once a second, or when forced.
     */
    update(
      dt: number,
      force: boolean,
      at: {
        /** The ship's distance from its aim, km, and its heliocentric position. */
        distance: number;
        ship: Readonly<Vec3d>;
        angles: { azimuth: number; inclination: number };
      },
      read: () => Readouts,
    ) {
      sinceFix += dt;
      hud.update(dt, force, { distance: at.distance, syncView: false, angles: at.angles }, (s) => {
        const r = read();
        const { ship } = at;
        const fixed =
          (force || sinceFix >= FIX_S) &&
          (ship[0] !== s.fix.km[0] || ship[1] !== s.fix.km[1] || ship[2] !== s.fix.km[2]);
        const values: Partial<VoyageStore> = { ...r };
        if (fixed) {
          sinceFix = 0;
          values.fix = { km: [ship[0], ship[1], ship[2]], seconds: r.earthSeconds };
        }
        return {
          moved:
            fixed ||
            r.aim !== s.aim ||
            r.flying !== s.flying ||
            r.phase !== s.phase ||
            r.regime !== s.regime ||
            r.gravityFrom !== s.gravityFrom ||
            movedBy(r.warp, s.warp, 0.02) ||
            movedBy(r.gravity, s.gravity, 0.02) ||
            movedBy(r.cmbKelvin, s.cmbKelvin, 0.01) ||
            ticked(r.shipSeconds, s.shipSeconds) ||
            ticked(r.earthSeconds, s.earthSeconds) ||
            movedBy(r.speed, s.speed, 0.01) ||
            movedBy(r.range, s.range, 0.005) ||
            movedBy(r.closing, s.closing, 0.01) ||
            movedBy(r.fromSun, s.fromSun, 0.005) ||
            movedBy(r.lightToEarth, s.lightToEarth, 0.005) ||
            movedBy(r.irradiance, s.irradiance, 0.01),
          values,
        };
      });
    },
  };
}
