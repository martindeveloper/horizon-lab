/**
 * Gravity about the ship: the bodies' gravitational parameters, the pull of a few wells at a
 * point, and the time scales that bound how finely a flight past them must be stepped. Newton
 * serves: near enough to a body for its pull to matter, the ship goes nowhere near light speed.
 */
import type { BodyId } from "@horizon/toolkit/bodies";
import { EARTH_GM_SI, SOLAR_GM_SI } from "@horizon/toolkit/science";

import type { AnchorId } from "./anchors";

/** The Sun's GM, km³/s². */
const SUN_GM = SOLAR_GM_SI / 1e9;

/**
 * Gravitational parameters GM, km³/s²: the IAU 2015 nominal Sun and Earth, the rest from the
 * JPL planetary (DE440) and satellite ephemerides; a planet's is its own, without its moons.
 * α Centauri A and B are 1.0788 and 0.9092 Sun masses (Akeson et al. 2021), Proxima 0.1221
 * (Mann et al. 2015's relation, as Kervella et al. 2017 adopt it). Small bodies left out pull
 * nothing the ship would notice.
 */
const GM_KM3_S2: Partial<Record<AnchorId, number>> = {
  sun: SUN_GM,
  mercury: 22_031.87,
  venus: 324_858.59,
  earth: EARTH_GM_SI / 1e9,
  moon: 4_902.8,
  mars: 42_828.37,
  phobos: 7.1e-4,
  deimos: 9.6e-5,
  jupiter: 126_686_531.9,
  io: 5_959.92,
  europa: 3_202.71,
  ganymede: 9_887.83,
  callisto: 7_179.29,
  saturn: 37_931_206.2,
  mimas: 2.5,
  enceladus: 7.21,
  tethys: 41.21,
  dione: 73.12,
  rhea: 153.94,
  titan: 8_978.14,
  iapetus: 120.51,
  uranus: 5_793_951.3,
  miranda: 4.32,
  ariel: 83.46,
  umbriel: 85.09,
  titania: 226.94,
  oberon: 205.32,
  neptune: 6_835_099.5,
  triton: 1_428.5,
  pluto: 869.3,
  charon: 106.1,
  alphaCen: 1.0788 * SUN_GM,
  alphaCenB: 0.9092 * SUN_GM,
  proxima: 0.1221 * SUN_GM,
};

/** A body's GM, km³/s²; zero for one that pulls nothing worth stepping. */
export const gmOf = (id: AnchorId | BodyId) => GM_KM3_S2[id as AnchorId] ?? 0;

/** A source of gravity over one step: where it is at the step's start, its velocity, its GM. */
export type Well = { pos: [number, number, number]; vel: [number, number, number]; gm: number };

export const createWell = (): Well => ({ pos: [0, 0, 0], vel: [0, 0, 0], gm: 0 });

/**
 * The pull at `x` (km), km/s², with each well moved `dt` seconds along its velocity: within a
 * frame the bodies move on straight lines, which their curvature over a frame never notices.
 */
export function gravityAt(
  x: ArrayLike<number>,
  wells: readonly Well[],
  dt: number,
  out: [number, number, number],
) {
  out[0] = out[1] = out[2] = 0;
  for (const w of wells) {
    if (w.gm <= 0) continue;
    const dx = w.pos[0] + w.vel[0] * dt - x[0]!;
    const dy = w.pos[1] + w.vel[1] * dt - x[1]!;
    const dz = w.pos[2] + w.vel[2] * dt - x[2]!;
    const r2 = dx * dx + dy * dy + dz * dz;
    if (r2 === 0) continue;
    const k = w.gm / (r2 * Math.sqrt(r2));
    out[0] += k * dx;
    out[1] += k * dy;
    out[2] += k * dz;
  }
  return out;
}

/** The dynamical time at `r` km from a well, seconds: an orbit there takes 2π of them. */
export const dynamicalTime = (r: number, gm: number) =>
  gm > 0 ? Math.sqrt((r * r * r) / gm) : Infinity;

/** The speed of a circular orbit at `r` km from a well, km/s. */
export const circularSpeed = (r: number, gm: number) => (gm > 0 ? Math.sqrt(gm / r) : 0);

/** Pieces a step is cut into at least: this many per dynamical time keep an orbit's energy. */
export const PIECES_PER_DYNAMICAL_TIME = 40;
