/**
 * Rings where the light reaching us today set out 1, 5 and 10 billion years ago: each shell drawn
 * as the outline the camera sees of it, named on its far side. A map drawn at a later scale
 * carries them outward with what they ring (`expansion`). A sphere of radius R seen from d shows a circle of
 * R √(1 − R²/d²), R²/d nearer than its centre (`shellOutline`).
 */
import {
  LineLoop,
  Vector3,
  type BufferGeometry,
  type Material,
  type Object3D,
  type Quaternion,
} from "three";

import type { PlaceLabel } from "@horizon/toolkit/scene";

import { LOOKBACK_RINGS_GYR, lookbackMly, lookbackRingKey } from "../model/cosmos";

/** The camera in the root's frame: its distance from the centre (Mly), its direction, up, and the turn facing it. */
export type RootView = { d: number; toward: Vector3; up: Vector3; facing: Quaternion };

/** A shell of radius `R` seen from `d`: the outline's radius and how far it sits toward the camera. */
export function shellOutline(R: number, d: number) {
  return d > R
    ? { radius: R * Math.sqrt(1 - (R / d) ** 2), offset: (R * R) / d }
    : { radius: R, offset: 0 };
}

export function createLookbackRings(root: Object3D, circle: BufferGeometry, material: Material) {
  const rings = LOOKBACK_RINGS_GYR.map((gyr) => {
    const line = new LineLoop(circle, material);
    line.frustumCulled = false;
    root.add(line);
    return { mly: lookbackMly(gyr), line, key: lookbackRingKey(gyr) };
  });
  const at = new Vector3();
  return {
    keys: rings.map((ring) => ring.key),
    hide(place: PlaceLabel) {
      for (const ring of rings) place(ring.key, 0, 0, 0, false);
    },
    /** This frame's outlines; `shown` is the names' presence. */
    update(view: RootView, expansion: number, shown: number, place: PlaceLabel) {
      const { d, toward, up, facing } = view;
      for (const ring of rings) {
        const R = ring.mly * expansion;
        const outside = d > R * 1.001;
        /* Faded out, the material skips the draw (the layer fades it). */
        ring.line.visible = outside;
        if (!outside) {
          place(ring.key, 0, 0, 0, false);
          continue;
        }
        const { radius, offset } = shellOutline(R, d);
        ring.line.position.copy(toward).multiplyScalar(offset);
        ring.line.quaternion.copy(facing);
        ring.line.scale.setScalar(radius);
        root.localToWorld(at.copy(ring.line.position).addScaledVector(up, radius));
        place(ring.key, at.x, at.y, at.z, shown);
      }
    },
  };
}
