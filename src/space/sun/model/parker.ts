import { keplerPosition, type Vec3 } from "@horizon/toolkit/bodies";

import {
  PARKER_ECCENTRICITY,
  PARKER_PERIHELION_EPOCH,
  PARKER_PERIHELION_R,
  PARKER_PERIOD_D,
} from "./parameters";

/**
 * Parker Solar Probe on its record orbit: an ellipse that plunges to 9.86 R☉ from the Sun's
 * centre every 88 days, then swings out past 150 R☉, near Venus's orbit, where it cools. The
 * probe is placed by Kepler's equation at the moment's phase, counted from a perihelion
 * Horizons gives. The plane and the perihelion's direction are the view's (the Sun's equator,
 * perihelion toward +x); the orbit's own tilt, 3.4° to the ecliptic, is left out. Before
 * 24 December 2024 Parker flew a slightly wider orbit with nearly the same period, so the
 * phase still falls near its real passes then.
 */

const DAY_MS = 86_400_000;

/** The ellipse's semi-major axis and its far point, solar radii. */
export const PARKER_SEMI_MAJOR_R = PARKER_PERIHELION_R / (1 - PARKER_ECCENTRICITY);
export const PARKER_APHELION_R = PARKER_SEMI_MAJOR_R * (1 + PARKER_ECCENTRICITY);

/** The mean anomaly at a moment (ms since 1970), degrees, 0 at perihelion. */
export function parkerMeanAnomaly(ms: number) {
  const orbits = (ms - PARKER_PERIHELION_EPOCH) / (PARKER_PERIOD_D * DAY_MS);
  return (orbits - Math.floor(orbits)) * 360;
}

/** The first perihelion at or after a moment, ms since 1970. */
export function nextParkerPerihelion(ms: number) {
  const period = PARKER_PERIOD_D * DAY_MS;
  return PARKER_PERIHELION_EPOCH + Math.ceil((ms - PARKER_PERIHELION_EPOCH) / period) * period;
}

/** Where the probe is at a moment, the Sun's centre the origin, world axes, solar radii. */
export const parkerAt = (ms: number, out: Vec3 = [0, 0, 0]): Vec3 =>
  keplerPosition(
    {
      a: PARKER_SEMI_MAJOR_R,
      e: PARKER_ECCENTRICITY,
      i: 0,
      omega: 0,
      node: 0,
      M: parkerMeanAnomaly(ms),
    },
    out,
  );
