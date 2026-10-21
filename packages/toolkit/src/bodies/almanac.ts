/**
 * Where the Sun is, and how the Moon is lit and turned: the series a sky view
 * needs, the Sun to about 0.01°, the Moon from the lunar theory (`lunarPosition`,
 * about 10″). Input is the Julian Ephemeris Day (`julianEphemerisDay` from the
 * science module); angles are degrees, ecliptic of date.
 *
 * Meeus = J. Meeus, Astronomical Algorithms, 2nd ed. (1998). Unlike
 * `ephemeris.ts` this module carries no planet tables, so a page that only
 * draws the sky stays small.
 */
import {
  AU_KM,
  eclipticToEquatorial,
  J2000_JD,
  JULIAN_CENTURY_DAYS,
  RAD_PER_DEG as RAD,
} from "../science";
import { lunarPosition } from "./lunar-theory";

/** Earth's equatorial radius, km (IAU WGCCRE 2015), for the Moon's parallax and `FIGURES`. */
export const EARTH_EQUATORIAL_RADIUS_KM = 6378.1366;

/**
 * Mean inclination of the lunar equator to the ecliptic, 1°32′32.7″ (IAU,
 * Meeus ch. 53). By Cassini's third law it is also the tilt of the Moon's spin
 * axis from the ecliptic pole.
 */
export const LUNAR_EQUATOR_INCLINATION_DEG = 1.54242;

/**
 * The Sun's apparent ecliptic longitude (degrees), distance (au) and the mean
 * obliquity of the ecliptic, from the low-precision Astronomical Almanac
 * series, about 0.01° from 1950 to 2050.
 */
export function solarEcliptic(jde: number) {
  const d = jde - J2000_JD;
  const g = (357.529 + 0.98560028 * d) * RAD;
  return {
    longitude: 280.459 + 0.98564736 * d + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g),
    distance: 1.00014 - 0.01671 * Math.cos(g) - 0.00014 * Math.cos(2 * g),
    obliquity: 23.439 - 0.00000036 * d,
  };
}

/**
 * Illuminated fraction of the Moon's disc and whether it is waxing, from the
 * geocentric elongation and both distances (Meeus 48.2–48.4).
 */
export function moonPhase(jde: number) {
  const moon = lunarPosition(jde);
  const sun = solarEcliptic(jde);
  const delta = (((moon.longitude - sun.longitude) % 360) + 360) % 360;
  const psi = Math.acos(Math.cos(moon.latitude * RAD) * Math.cos(delta * RAD));
  const r = sun.distance * AU_KM;
  const i = Math.atan2(r * Math.sin(psi), moon.distanceKm - r * Math.cos(psi));
  return { illumination: (1 + Math.cos(i)) / 2, waxing: delta < 180 };
}

/**
 * Position angle of the Moon's rotation axis, east of celestial north, in
 * degrees (Meeus 53.1 and the following, without nutation or physical
 * libration: within about 0.2°).
 */
export function moonAxis(jde: number) {
  const t = (jde - J2000_JD) / JULIAN_CENTURY_DAYS;
  const node = (125.0445479 - 1934.1362891 * t + 0.0020754 * t * t) * RAD;
  const moon = lunarPosition(jde);
  const obliquity = solarEcliptic(jde).obliquity * RAD;
  const i = LUNAR_EQUATOR_INCLINATION_DEG * RAD;
  const w = moon.longitude * RAD - node;
  const beta = moon.latitude * RAD;
  const b = Math.asin(-Math.sin(w) * Math.cos(beta) * Math.sin(i) - Math.sin(beta) * Math.cos(i));
  const x = Math.sin(i) * Math.sin(node);
  const y = Math.sin(i) * Math.cos(node) * Math.cos(obliquity) - Math.cos(i) * Math.sin(obliquity);
  const omega = Math.atan2(x, y);
  const ra = eclipticToEquatorial(moon.longitude, moon.latitude, obliquity / RAD).ra * RAD;
  return Math.asin((Math.hypot(x, y) * Math.cos(ra - omega)) / Math.cos(b)) / RAD;
}
