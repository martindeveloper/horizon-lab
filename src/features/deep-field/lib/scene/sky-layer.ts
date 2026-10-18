/**
 * The bright stars of our own sky, carried with the camera: what the Sun's neighbourhood sees
 * beyond its nearest stars. They fade as the camera pulls out into the disk, where the Galaxy
 * map in the same directions takes over.
 */
import { Points, type Object3D } from "three";

import { brightStarGeometry } from "@/space/bright-stars";

import type { Frame, SceneKit } from "./kit";

export function createSkyLayer({ scope, looks, camera, lod }: SceneKit, parent: Object3D) {
  /* Points share one size, so brightness carries the magnitude. */
  const sky = new Points(scope.own(brightStarGeometry({ floor: 0.35, full: 0.5 })), looks.sky);
  sky.frustumCulled = false;
  sky.renderOrder = -2;
  parent.add(sky);
  const base = looks.sky.opacity;
  return {
    update({ dist }: Frame) {
      const shown = 1 - lod.galaxy;
      sky.visible = shown > 0.001;
      if (!sky.visible) return;
      looks.sky.opacity = base * shown;
      sky.position.copy(camera.position);
      sky.scale.setScalar(Math.max(12, dist * 20));
    },
  };
}
