import { keplerPosition, type Elements, type Vec3 } from "@horizon/toolkit/bodies";
import { AU_KM, CELSIUS_ZERO_K, DAY_SECONDS, SOLAR_RADIUS_KM } from "@horizon/toolkit/science";

import {
  PARKER_EARLIER_ECCENTRICITY,
  PARKER_EARLIER_PERIHELION_EPOCH,
  PARKER_EARLIER_PERIHELION_R,
  PARKER_EARLIER_PERIOD_D,
  PARKER_EARLIER_TURN_DEG,
  PARKER_ECCENTRICITY,
  PARKER_ELEMENTS_EPOCH,
  PARKER_LAST_FLYBY,
  PARKER_PERIHELION_EPOCH,
  PARKER_PERIHELION_R,
  PARKER_PERIOD_D,
  PARKER_SHIELD_PERIHELION_C,
} from "./parameters";

/**
 * Parker Solar Probe on the orbit it flew at the moment: until its last Venus flyby (6 November
 * 2024) the earlier one, down to 11.4 R☉ from the Sun's centre every 92 days; since then its
 * record orbit, down to 9.86 R☉ every 88 days, with no flyby left to bring it closer. Out past
 * 150 R☉, near Venus's orbit, it cools. The probe is placed by Kepler's equation at the
 * moment's phase, counted from a perihelion Horizons gives for that orbit. The plane is the
 * view's (the Sun's equator), the record orbit's perihelion toward +x and the earlier one's as
 * far from it as Horizons has it, so the probe passes from one to the other where it flew; the
 * orbits' own tilt, 3.4° to the ecliptic, is left out.
 */

const DAY_MS = DAY_SECONDS * 1000;

/** One of Parker's orbits: its perihelion (R☉), eccentricity, period (days), a perihelion's moment (ms) and its perihelion's turn from the record orbit's (degrees). */
export type ParkerOrbit = {
  perihelion: number;
  eccentricity: number;
  periodD: number;
  perihelionAt: number;
  turnDeg: number;
};

export const PARKER_EARLIER_ORBIT: ParkerOrbit = {
  perihelion: PARKER_EARLIER_PERIHELION_R,
  eccentricity: PARKER_EARLIER_ECCENTRICITY,
  periodD: PARKER_EARLIER_PERIOD_D,
  perihelionAt: PARKER_EARLIER_PERIHELION_EPOCH,
  turnDeg: PARKER_EARLIER_TURN_DEG,
};

export const PARKER_RECORD_ORBIT: ParkerOrbit = {
  perihelion: PARKER_PERIHELION_R,
  eccentricity: PARKER_ECCENTRICITY,
  periodD: PARKER_PERIOD_D,
  perihelionAt: PARKER_PERIHELION_EPOCH,
  turnDeg: 0,
};

/** Where the probe stands at a moment is predicted, not flown: past its latest elements' date. */
export const parkerPredicted = (ms: number) => ms > PARKER_ELEMENTS_EPOCH;

/** The orbit Parker flew at a moment (ms since 1970). */
export const parkerOrbitAt = (ms: number) =>
  ms < PARKER_LAST_FLYBY ? PARKER_EARLIER_ORBIT : PARKER_RECORD_ORBIT;

/** An orbit's semi-major axis and far point, solar radii. */
export const semiMajorOf = (orbit: ParkerOrbit) => orbit.perihelion / (1 - orbit.eccentricity);
export const aphelionOf = (orbit: ParkerOrbit) => semiMajorOf(orbit) * (1 + orbit.eccentricity);

/** The record orbit's semi-major axis and far point, solar radii. */
export const PARKER_SEMI_MAJOR_R = semiMajorOf(PARKER_RECORD_ORBIT);
export const PARKER_APHELION_R = aphelionOf(PARKER_RECORD_ORBIT);
/** The farthest Parker swings out on any orbit the lab flies, solar radii. */
export const PARKER_FARTHEST_R = Math.max(PARKER_APHELION_R, aphelionOf(PARKER_EARLIER_ORBIT));

/** The mean anomaly at a moment (ms since 1970) on the orbit then, degrees, 0 at perihelion. */
export function parkerMeanAnomaly(ms: number) {
  const orbit = parkerOrbitAt(ms);
  const orbits = (ms - orbit.perihelionAt) / (orbit.periodD * DAY_MS);
  return (orbits - Math.floor(orbits)) * 360;
}

/** The first perihelion at or after a moment, ms since 1970: on the record orbit once the flyby comes first. */
export function nextParkerPerihelion(ms: number): number {
  const orbit = parkerOrbitAt(ms);
  const period = orbit.periodD * DAY_MS;
  const next = orbit.perihelionAt + Math.ceil((ms - orbit.perihelionAt) / period) * period;
  return orbit === PARKER_EARLIER_ORBIT && next >= PARKER_LAST_FLYBY
    ? nextParkerPerihelion(PARKER_LAST_FLYBY)
    : next;
}

/** The probe's orbit at a moment (solar radii, degrees): the view's plane, the record perihelion toward +x. */
export function parkerElements(
  ms: number,
  out: Elements = { a: 0, e: 0, i: 0, omega: 0, node: 0, M: 0 },
) {
  const orbit = parkerOrbitAt(ms);
  out.a = semiMajorOf(orbit);
  out.e = orbit.eccentricity;
  out.i = out.node = 0;
  out.omega = orbit.turnDeg;
  out.M = parkerMeanAnomaly(ms);
  return out;
}

const elements = parkerElements(0);

/** Where the probe is at a moment, the Sun's centre the origin, world axes, solar radii. */
export const parkerAt = (ms: number, out: Vec3 = [0, 0, 0]): Vec3 =>
  keplerPosition(parkerElements(ms, elements), out);

/** One astronomical unit in solar radii: where sunlight has its Earth strength. */
const AU_R = AU_KM / SOLAR_RADIUS_KM;

/** How much stronger the sunlight is than at Earth's mean distance, at `r` solar radii. */
export const parkerSunlight = (r: number) => (AU_R / r) ** 2;

/**
 * The heat shield's sunward face at `r` solar radii, °C: a surface in radiative balance warms
 * as the fourth root of the light it takes, so as r^−½, from NASA's figure at perihelion.
 */
export const parkerShieldC = (r: number) =>
  (PARKER_SHIELD_PERIHELION_C + CELSIUS_ZERO_K) * Math.sqrt(PARKER_PERIHELION_R / r) -
  CELSIUS_ZERO_K;
