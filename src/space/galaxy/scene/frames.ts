/**
 * One world in au, for every engine that draws the Galaxy and the cosmic map: the nearest stars
 * round the Sun, the Galaxy around them, the cosmic map beyond. The Galaxy model stays in
 * light-years; its group is turned by `GALAXY_FRAME` (the galactic frame of the sky's J2000 pole
 * and centre) and scaled by one light-year, with the Sun at the origin. The cosmic map is in
 * millions of light-years in the same axes, around the galactic centre. The blends between the
 * three scales (`galaxyMix`, `cosmosMix`) and the scale that dominates (`realmOf`) are here too.
 */
import { Matrix4, Quaternion, Vector3 } from "three";

import { SUPERGALACTIC } from "@/space/cosmos/model/cosmos";
import { logFraction, smootherstep } from "@horizon/toolkit/math";
import { GALACTIC_CENTRE, GALACTIC_EAST, GALACTIC_POLE } from "@horizon/toolkit/scene";
import { LIGHT_YEAR_AU } from "@horizon/toolkit/science";

import { sunGalactic } from "../model/galactic-orbit";
import type { Realm } from "../show";

export const LY = LIGHT_YEAR_AU;
/** One million light-years in au: the cosmic map's unit. */
export const MLY = 1e6 * LY;

/** From the nearest stars to the Galaxy, au: past the neighbours, into the local disk. */
export const HANDOFF = { from: 7 * LY, to: 950 * LY } as const;
/** From the Galaxy to the cosmic map, au: past the halo, the Galaxy becomes one of many. */
export const COSMIC_HANDOFF = { from: 350_000 * LY, to: 3_000_000 * LY } as const;

/** The Galaxy's and the cosmic map's own render pass (drawn first, with a depth range of its own). */
export const GALAXY_LAYER = 2;

/**
 * Galaxy-model axes → scene: +X points from the centre to the Sun, +Y is the north galactic
 * pole, +Z the direction of rotation (galactic longitude 90°).
 */
export const GALAXY_FRAME = new Quaternion().setFromRotationMatrix(
  new Matrix4().makeBasis(GALACTIC_CENTRE.clone().negate(), GALACTIC_POLE, GALACTIC_EAST),
);

/**
 * Supergalactic axes → scene, as `GALAXY_FRAME` does for galactic ones: +Y the supergalactic
 * pole, +X toward SGL = 0. The nearby galaxies lie flat in this plane, so far out the camera
 * orbits in it.
 */
export const SUPERGALACTIC_FRAME = (() => {
  const { x, y, z } = SUPERGALACTIC;
  const basis = new Quaternion().setFromRotationMatrix(
    new Matrix4().makeBasis(new Vector3(...x), new Vector3(...z), new Vector3(-y[0], -y[1], -y[2])),
  );
  return GALAXY_FRAME.clone().multiply(basis);
})();

/** Where the Sun sits in the Galaxy model today (ly): the scene's origin. */
export const SUN_ANCHOR: Readonly<[number, number, number]> = sunGalactic(0);

/** A Galaxy-model point (ly) in the scene (au), with the Sun at the origin. */
export function galaxyToWorld(x: number, y: number, z: number, out: Vector3) {
  return out
    .set(x - SUN_ANCHOR[0], y - SUN_ANCHOR[1], z - SUN_ANCHOR[2])
    .applyQuaternion(GALAXY_FRAME)
    .multiplyScalar(LY);
}

/** A cosmic-map point (Mly from the galactic centre) in the scene (au). */
export function cosmicToWorld(v: readonly [number, number, number], out: Vector3) {
  return galaxyToWorld(v[0] * 1e6, v[1] * 1e6, v[2] * 1e6, out);
}

/** 0 among the nearest stars, 1 in the Galaxy (and beyond), for a camera distance in au. */
export function galaxyMix(dist: number) {
  return smootherstep(logFraction(dist, HANDOFF.from, HANDOFF.to));
}

/** 0 up to the Galaxy, 1 on the cosmic map, for a camera distance in au. */
export function cosmosMix(dist: number) {
  return smootherstep(logFraction(dist, COSMIC_HANDOFF.from, COSMIC_HANDOFF.to));
}

/** From this camera distance (au), just beyond Proxima, the nearest stars hold the view. */
const STARS_FROM = 300_000;

/** The scale that dominates at a camera distance (au): what readouts and cards follow. */
export function realmOf(dist: number): Realm {
  if (cosmosMix(dist) >= 0.5) {
    return "cosmos";
  }
  if (galaxyMix(dist) >= 0.5) {
    return "galaxy";
  }
  if (dist < STARS_FROM) {
    return "solar";
  }
  return "stars";
}
