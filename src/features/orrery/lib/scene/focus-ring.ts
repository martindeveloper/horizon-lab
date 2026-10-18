/** The gold reticle around the selected body, and where that body is this frame. */
import { Mesh, PlaneGeometry, type Object3D } from "three";

import { NAMED, keplerPosition } from "@horizon/toolkit/bodies";
import { REDUCED_MOTION_QUERY } from "@horizon/toolkit/environment";

import { namedElements, planetElements } from "../model/elements";
import { TRACERS, tracerElements, tracerVisible } from "../model/tracers";
import type { Frame, SceneKit } from "./kit";

type Point = [number, number, number];

/** Half-width of the reticle quad, in screen pixels; the circle sits at ~19 px. */
const RETICLE_PX = 30;
/** Seconds for a new selection to lock on, and for the glow's slow swell. */
const LOCK_S = 0.7;
const BREATH_S = 3.2;

export function createFocusRing({ scope, looks, pxWorld }: SceneKit, parent: Object3D) {
  // Faces the camera in its vertex shader; drawn wider than its geometry, so never culled.
  const ring = new Mesh(scope.own(new PlaneGeometry(2, 2)), looks.focus);
  ring.renderOrder = 10;
  ring.frustumCulled = false;
  parent.add(ring);
  const uniforms = looks.focus.uniforms;
  const still = window.matchMedia(REDUCED_MOTION_QUERY);
  let held: Frame["sel"] = null;
  let since = 0;

  const locate = ({ sel, mig, driftYears, now }: Frame): Point | null => {
    if (sel?.kind === "sun") return [0, 0, 0];
    if (sel?.kind === "planet") return keplerPosition(planetElements(sel.id, mig, driftYears, now));
    if (sel?.kind === "named")
      return keplerPosition(
        namedElements(
          NAMED.find((b) => b.id === sel.id)!,
          mig,
          driftYears,
          now,
        ),
      );
    if (sel?.kind === "tracer") {
      const tr = TRACERS[sel.index];
      if (tr && tracerVisible(tr, mig)) return keplerPosition(tracerElements(tr, mig, driftYears));
    }
    return null;
  };

  return {
    /** Draws the ring unless a close-up hides it; returns the selected body's position. */
    update(f: Frame, hidden: boolean) {
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
        uniforms.size!.value = pxWorld(f.dist, RETICLE_PX);
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
