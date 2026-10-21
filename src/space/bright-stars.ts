/**
 * The bright stars of the shared J2000 catalogue at their real directions on a unit sphere,
 * coloured by B−V and weighted by magnitude: the sky both simulations carry with the camera.
 */
import { BufferAttribute, Points, Vector3, type Material, type Object3D } from "three";

import { STARS, starColor } from "@/space/star-catalogue";
import type { DisposalScope } from "@horizon/toolkit/rendering";
import { equatorialToScene, pointsGeometry } from "@horizon/toolkit/scene";

/**
 * Effective temperature from B−V by Ballesteros (2012, EPL 97, 34008): the black-body fit
 * T = 4600 (1/(0.92 (B−V) + 1.7) + 1/(0.92 (B−V) + 0.62)), good to a few per cent for
 * main-sequence stars (the Sun's 0.65 gives 5,780 K).
 */
export function ballesterosTemperature(bv: number) {
  return 4600 * (1 / (0.92 * bv + 1.7) + 1 / (0.92 * bv + 0.62));
}

/**
 * How bright the faintest star draws (`floor`), the magnitude drawn at full, and a `size` per
 * star, if any (a `size` attribute; without it, points share one size and brightness alone
 * carries the magnitude). With `distanceOf` (a star's distance in parsecs by name; 0 for
 * none, placed far enough to show no parallax), each star also carries a `distance` attribute
 * and a `temperature` attribute (kelvin, from B−V), for a sky a ship flies through; the
 * positions and colours are the same either way.
 */
export type BrightSkyLook = {
  floor: number;
  full: number;
  size?: (mag: number) => number;
  distanceOf?: (name: string) => number;
};

/** Where a star without a known distance is placed, parsecs: far enough to show no parallax. */
export const FAR_SKY_PC = 1000;

export function brightStarGeometry({ floor, full, size, distanceOf }: BrightSkyLook) {
  const n = STARS.length;
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const sizes = size ? new Float32Array(n) : null;
  const distances = distanceOf ? new Float32Array(n) : null;
  const temperatures = distanceOf ? new Float32Array(n) : null;
  const v = new Vector3();
  for (let i = 0; i < n; i += 1) {
    const [name, ra, dec, mag, bv] = STARS[i]!;
    equatorialToScene(ra * 15, dec, v);
    pos.set([v.x, v.y, v.z], i * 3);
    const [r, g, b] = starColor(bv);
    const bright = floor + (1 - floor) * Math.min(1, 10 ** (-0.4 * (mag - full)));
    col.set([(r / 255) * bright, (g / 255) * bright, (b / 255) * bright], i * 3);
    if (sizes && size) sizes[i] = size(mag);
    if (distances && distanceOf) distances[i] = distanceOf(name) || FAR_SKY_PC;
    if (temperatures) temperatures[i] = ballesterosTemperature(bv);
  }
  const geometry = pointsGeometry(pos, col, sizes);
  if (distances && temperatures) {
    geometry.setAttribute("distance", new BufferAttribute(distances, 1));
    geometry.setAttribute("temperature", new BufferAttribute(temperatures, 1));
  }
  return geometry;
}

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
