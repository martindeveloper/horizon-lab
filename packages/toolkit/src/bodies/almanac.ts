/**
 * Where the Sun and the Moon are, and how the Moon is lit and turned: the
 * low-precision series a sky view needs, good to about 0.01°. Input is the
 * Julian Ephemeris Day (`julianEphemerisDay` from the science module); angles
 * are degrees, ecliptic of date.
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

/* Meeus, Astronomical Algorithms (2nd ed.), table 47.A: the 32 largest
   periodic terms in longitude (1e-6 °) and distance (1e-3 km), as
   multiples of D, M, M′, F. Truncation leaves errors near 0.01°. */
const MOON_LR = [
  [0, 0, 1, 0, 6288774, -20905355],
  [2, 0, -1, 0, 1274027, -3699111],
  [2, 0, 0, 0, 658314, -2955968],
  [0, 0, 2, 0, 213618, -569925],
  [0, 1, 0, 0, -185116, 48888],
  [0, 0, 0, 2, -114332, -3149],
  [2, 0, -2, 0, 58793, 246158],
  [2, -1, -1, 0, 57066, -152138],
  [2, 0, 1, 0, 53322, -170733],
  [2, -1, 0, 0, 45758, -204586],
  [0, 1, -1, 0, -40923, -129620],
  [1, 0, 0, 0, -34720, 108743],
  [0, 1, 1, 0, -30383, 104755],
  [2, 0, 0, -2, 15327, 10321],
  [0, 0, 1, 2, -12528, 0],
  [0, 0, 1, -2, 10980, 79661],
  [4, 0, -1, 0, 10675, -34782],
  [0, 0, 3, 0, 10034, -23210],
  [4, 0, -2, 0, 8548, -21636],
  [2, 1, -1, 0, -7888, 24208],
  [2, 1, 0, 0, -6766, 30824],
  [1, 0, -1, 0, -5163, -8379],
  [1, 1, 0, 0, 4987, -16675],
  [2, -1, 1, 0, 4036, -12831],
  [2, 0, 2, 0, 3994, -10445],
  [4, 0, 0, 0, 3861, -11650],
  [2, 0, -3, 0, 3665, 14403],
  [0, 1, -2, 0, -2689, -7003],
  [2, 0, -1, 2, -2602, 0],
  [2, -1, -2, 0, 2390, 10056],
  [1, 0, 1, 0, -2348, 6322],
  [2, -2, 0, 0, 2236, -9884],
] as const;

/* Table 47.B: the 20 largest terms in latitude (1e-6 °). */
const MOON_B = [
  [0, 0, 0, 1, 5128122],
  [0, 0, 1, 1, 280602],
  [0, 0, 1, -1, 277693],
  [2, 0, 0, -1, 173237],
  [2, 0, -1, 1, 55413],
  [2, 0, -1, -1, 46271],
  [2, 0, 0, 1, 32573],
  [0, 0, 2, 1, 17198],
  [2, 0, 1, -1, 9266],
  [0, 0, 2, -1, 8822],
  [2, -1, 0, -1, 8216],
  [2, 0, -2, -1, 4324],
  [2, 0, 1, 1, 4200],
  [2, 1, 0, -1, -3359],
  [2, -1, -1, 1, 2463],
  [2, -1, 0, 1, 2211],
  [2, -1, -1, -1, 2065],
  [0, 1, -1, -1, -1870],
  [4, 0, -1, -1, 1828],
  [0, 1, 0, 1, -1794],
] as const;

/** Geocentric ecliptic longitude and latitude (degrees) and distance (km) of the Moon (Meeus ch. 47). */
export function moonEcliptic(jde: number) {
  const t = (jde - J2000_JD) / JULIAN_CENTURY_DAYS;
  const t2 = t * t;
  const t3 = t2 * t;
  const t4 = t3 * t;
  const lp = 218.3164477 + 481267.88123421 * t - 0.0015786 * t2 + t3 / 538841 - t4 / 65194000;
  const d = 297.8501921 + 445267.1114034 * t - 0.0018819 * t2 + t3 / 545868 - t4 / 113065000;
  const m = 357.5291092 + 35999.0502909 * t - 0.0001536 * t2 + t3 / 24490000;
  const mp = 134.9633964 + 477198.8675055 * t + 0.0087414 * t2 + t3 / 69699 - t4 / 14712000;
  const f = 93.272095 + 483202.0175233 * t - 0.0036539 * t2 - t3 / 3526000 + t4 / 863310000;
  const e = 1 - 0.002516 * t - 0.0000074 * t2;
  const a1 = 119.75 + 131.849 * t;
  const a2 = 53.09 + 479264.29 * t;
  const a3 = 313.45 + 481266.484 * t;
  const eccentricity = (mm: number) => (mm === 0 ? 1 : Math.abs(mm) === 1 ? e : e * e);
  let sl = 0;
  let sr = 0;
  for (const [cd, cm, cmp, cf, l, r] of MOON_LR) {
    const arg = (cd * d + cm * m + cmp * mp + cf * f) * RAD;
    const k = eccentricity(cm);
    sl += l * k * Math.sin(arg);
    sr += r * k * Math.cos(arg);
  }
  let sb = 0;
  for (const [cd, cm, cmp, cf, b] of MOON_B) {
    sb += b * eccentricity(cm) * Math.sin((cd * d + cm * m + cmp * mp + cf * f) * RAD);
  }
  sl += 3958 * Math.sin(a1 * RAD) + 1962 * Math.sin((lp - f) * RAD) + 318 * Math.sin(a2 * RAD);
  sb +=
    -2235 * Math.sin(lp * RAD) +
    382 * Math.sin(a3 * RAD) +
    175 * Math.sin((a1 - f) * RAD) +
    175 * Math.sin((a1 + f) * RAD) +
    127 * Math.sin((lp - mp) * RAD) -
    115 * Math.sin((lp + mp) * RAD);
  return {
    longitude: (((lp + sl / 1e6) % 360) + 360) % 360,
    latitude: sb / 1e6,
    distance: 385000.56 + sr / 1000,
  };
}

/**
 * Illuminated fraction of the Moon's disc and whether it is waxing, from the
 * geocentric elongation and both distances (Meeus 48.2–48.4).
 */
export function moonPhase(jde: number) {
  const moon = moonEcliptic(jde);
  const sun = solarEcliptic(jde);
  const delta = (((moon.longitude - sun.longitude) % 360) + 360) % 360;
  const psi = Math.acos(Math.cos(moon.latitude * RAD) * Math.cos(delta * RAD));
  const r = sun.distance * AU_KM;
  const i = Math.atan2(r * Math.sin(psi), moon.distance - r * Math.cos(psi));
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
  const moon = moonEcliptic(jde);
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
