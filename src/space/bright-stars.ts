/**
 * The bright stars of the shared J2000 catalogue at their real directions on a unit sphere,
 * coloured by B−V and weighted by magnitude: the sky both simulations carry with the camera.
 */
import { Points, Vector3, type Material, type Object3D } from "three";

import { STARS, starColor } from "@/space/star-catalogue";
import type { DisposalScope } from "@horizon/toolkit/rendering";
import { equatorialToScene, pointsGeometry } from "@horizon/toolkit/scene";

/**
 * Brightness runs from `floor` for the faintest star up to full at magnitude `full`. With
 * `size`, each star also gets a point size (a `size` attribute); without it, points share one
 * size and brightness alone carries the magnitude.
 */
function brightStarGeometry({
  floor,
  full,
  size,
}: {
  floor: number;
  full: number;
  size?: (mag: number) => number;
}) {
  const n = STARS.length;
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const sizes = size ? new Float32Array(n) : null;
  const v = new Vector3();
  for (let i = 0; i < n; i += 1) {
    const [, ra, dec, mag, bv] = STARS[i]!;
    equatorialToScene(ra * 15, dec, v);
    pos.set([v.x, v.y, v.z], i * 3);
    const [r, g, b] = starColor(bv);
    const bright = floor + (1 - floor) * Math.min(1, 10 ** (-0.4 * (mag - full)));
    col.set([(r / 255) * bright, (g / 255) * bright, (b / 255) * bright], i * 3);
    if (sizes && size) sizes[i] = size(mag);
  }
  return pointsGeometry(pos, col, sizes);
}

/** How bright the faintest star draws, and the magnitude drawn at full; `size` per star, if any. */
export type BrightSkyLook = Parameters<typeof brightStarGeometry>[0];

/**
 * The bright stars as points on the unit sphere, drawn behind everything in the scene and
 * never culled: the sphere is centred on the camera (`carrySky`), so it is always in view.
 */
export function createBrightSky(scope: DisposalScope, material: Material, look: BrightSkyLook) {
  const sky = new Points(scope.own(brightStarGeometry(look)), material);
  sky.renderOrder = -2;
  sky.frustumCulled = false;
  return sky;
}

/** Keeps a sky on the camera, far beyond the aim at this camera distance, so it never parallaxes. */
export function carrySky(sky: Object3D, camera: { position: Vector3 }, dist: number) {
  sky.position.copy(camera.position);
  sky.scale.setScalar(Math.max(12, dist * 20));
}
