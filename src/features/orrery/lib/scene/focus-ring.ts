/** The gold ring around the selected body, and where that body is this frame. */
import { Mesh, RingGeometry, type Object3D } from "three";

import { NAMED, keplerPosition } from "@horizon/toolkit/bodies";

import { namedElements, planetElements } from "../model/elements";
import { TRACERS, tracerElements, tracerVisible } from "../model/tracers";
import type { Frame, SceneKit } from "./kit";

type Point = [number, number, number];

export function createFocusRing({ scope, looks, pxWorld }: SceneKit, parent: Object3D) {
  const ring = new Mesh(scope.own(new RingGeometry(0.75, 1, 40)), looks.focus);
  ring.rotation.x = Math.PI / 2;
  ring.renderOrder = 10;
  parent.add(ring);

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
      if (at) {
        ring.position.set(at[0], at[1], at[2]);
        ring.scale.setScalar(pxWorld(f.dist, 20));
      }
      return at;
    },
  };
}
