/** The gold reticle around the selected body, and where that body is this frame. */
import { Mesh, PlaneGeometry, type Object3D } from "three";

import type { Vec3 } from "@horizon/toolkit/bodies";
import { REDUCED_MOTION_QUERY } from "@horizon/toolkit/environment";

import { positionOf } from "../model/position";
import type { SolarSelection } from "../model/selection";
import type { SolarFrame, SolarKit } from "./kit";

type Point = Vec3;

/** Half-width of the reticle quad, in screen pixels; the circle sits at ~19 px. */
const RETICLE_PX = 30;
/** Seconds for a new selection to lock on, and for the glow's slow swell. */
const LOCK_S = 0.7;
const BREATH_S = 3.2;

/**
 * `drawnAt`: where the scene draws a selection when that differs from its true position (a
 * moon in a magnified system; null while it is hidden), or undefined to use the true one.
 */
export function createFocusRing(
  { scope, looks, pxWorld, camera }: SolarKit,
  parent: Object3D,
  drawnAt: (sel: SolarSelection) => Vec3 | null | undefined = () => undefined,
) {
  // Faces the camera in its vertex shader; drawn wider than its geometry, so never culled.
  const ring = new Mesh(scope.own(new PlaneGeometry(2, 2)), looks.focus);
  ring.renderOrder = 10;
  ring.frustumCulled = false;
  parent.add(ring);
  const uniforms = looks.focus.uniforms;
  const still = window.matchMedia(REDUCED_MOTION_QUERY);
  let held: SolarFrame["sel"] = null;
  let since = 0;
  const at: Vec3 = [0, 0, 0];

  const locate = (f: SolarFrame): Point | null => {
    if (!f.sel) return null;
    const drawn = drawnAt(f.sel);
    return drawn === undefined ? positionOf(f.sel, f, f.now, at) : drawn;
  };

  return {
    /** Draws the ring unless a close-up hides it; returns the selected body's position. */
    update(f: SolarFrame, hidden: boolean) {
      const at = locate(f);
      ring.visible = !!at && !hidden;
      const now = performance.now() / 1000;
      // A new selection, or one coming back into view, locks on afresh.
      if (!ring.visible || f.sel !== held) {
        held = ring.visible ? f.sel : null;
        since = now;
      }
      if (at) {
        ring.position.set(at[0], at[1], at[2]);
        /* Constant on screen at the body's own distance, not the aim's. */
        uniforms.size!.value = pxWorld(camera.position.distanceTo(ring.position), RETICLE_PX);
        const t = still.matches ? 1 : Math.min(1, (now - since) / LOCK_S);
        uniforms.lock!.value = 1 - (1 - t) ** 3;
        uniforms.breath!.value = still.matches
          ? 0.5
          : 0.5 - 0.5 * Math.cos((2 * Math.PI * now) / BREATH_S);
      }
      return at;
    },
  };
}
