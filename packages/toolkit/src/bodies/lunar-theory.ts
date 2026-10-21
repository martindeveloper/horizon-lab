/**
 * The Moon's geocentric place from the ELP-2000/82 lunar theory as Chapront-Touzé and
 * Chapront truncated it for Meeus (Astronomical Algorithms, 2nd ed., chapter 47): the sixty
 * largest periodic terms each in longitude, distance and latitude, plus the Venus, Jupiter
 * and flattening terms. Good to about 10″ in longitude, 4″ in latitude and 4 km in distance;
 * the mean elements it replaces wander by degrees. Angles are referred to the mean equinox
 * and ecliptic of date; `lunarPositionJ2000` precesses them back to J2000 for a scene whose
 * axes are fixed there.
 */
import { wrap } from "../math";
import { J2000_JD, RAD_PER_DEG as RAD, julianEphemerisDay } from "../science";
import type { Vec3 } from "./frames";

/** One periodic term: multiples of D, M, M′ and F, and the coefficient (10⁻⁶ degrees, or metres). */
type Term = readonly [d: number, m: number, mp: number, f: number, coefficient: number];

/** Table 47.A: longitude Σl (10⁻⁶ °) and distance Σr (10⁻³ km), by the same arguments. */
const LONGITUDE_DISTANCE: readonly (readonly [number, number, number, number, number, number])[] = [
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
  [0, 1, 2, 0, -2120, 5751],
  [0, 2, 0, 0, -2069, 0],
  [2, -2, -1, 0, 2048, -4950],
  [2, 0, 1, -2, -1773, 4130],
  [2, 0, 0, 2, -1595, 0],
  [4, -1, -1, 0, 1215, -3958],
  [0, 0, 2, 2, -1110, 0],
  [3, 0, -1, 0, -892, 3258],
  [2, 1, 1, 0, -810, 2616],
  [4, -1, -2, 0, 759, -1897],
  [0, 2, -1, 0, -713, -2117],
  [2, 2, -1, 0, -700, 2354],
  [2, 1, -2, 0, 691, 0],
  [2, -1, 0, -2, 596, 0],
  [4, 0, 1, 0, 549, -1423],
  [0, 0, 4, 0, 537, -1117],
  [4, -1, 0, 0, 520, -1571],
  [1, 0, -2, 0, -487, -1739],
  [2, 1, 0, -2, -399, 0],
  [0, 0, 2, -2, -381, -4421],
  [1, 1, 1, 0, 351, 0],
  [3, 0, -2, 0, -340, 0],
  [4, 0, -3, 0, 330, 0],
  [2, -1, 2, 0, 327, 0],
  [0, 2, 1, 0, -323, 1165],
  [1, 1, -1, 0, 299, 0],
  [2, 0, 3, 0, 294, 0],
  [2, 0, -1, -2, 0, 8752],
];

/** Table 47.B: latitude Σb (10⁻⁶ °). */
const LATITUDE: readonly Term[] = [
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
  [0, 0, 0, 3, -1749],
  [0, 1, -1, 1, -1565],
  [1, 0, 0, 1, -1491],
  [0, 1, 1, 1, -1475],
  [0, 1, 1, -1, -1410],
  [0, 1, 0, -1, -1344],
  [1, 0, 0, -1, -1335],
  [0, 0, 3, 1, 1107],
  [4, 0, 0, -1, 1021],
  [4, 0, -1, 1, 833],
  [0, 0, 1, -3, 777],
  [4, 0, -2, 1, 671],
  [2, 0, 0, -3, 607],
  [2, 0, 2, -1, 596],
  [2, -1, 1, -1, 491],
  [2, 0, -2, 1, -451],
  [0, 0, 3, -1, 439],
  [2, 0, 2, 1, 422],
  [2, 0, -3, -1, 421],
  [2, 1, -1, 1, -366],
  [2, 1, 0, 1, -351],
  [4, 0, 0, 1, 331],
  [2, -1, 1, 1, 315],
  [2, -2, 0, -1, 302],
  [0, 0, 1, 3, -283],
  [2, 1, 1, -1, -229],
  [1, 1, 0, -1, 223],
  [1, 1, 0, 1, 223],
  [0, 1, -2, -1, -220],
  [2, 1, -1, -1, -220],
  [1, 0, 1, 1, -185],
  [2, -1, -2, -1, 181],
  [0, 1, 2, 1, -177],
  [4, 0, -2, -1, 176],
  [4, -1, -1, -1, 166],
  [1, 0, 1, -1, -164],
  [4, 0, 1, -1, 132],
  [1, 0, -1, -1, -119],
  [4, -1, 0, -1, 115],
  [2, -2, 0, 1, 107],
];

/** Mean distance the periodic terms are added to, km. */
const MEAN_DISTANCE_KM = 385_000.56;

export type LunarPosition = {
  /** Geocentric ecliptic longitude, degrees. */
  longitude: number;
  /** Geocentric ecliptic latitude, degrees. */
  latitude: number;
  /** Earth's centre to the Moon's, km. */
  distanceKm: number;
};

const wrapDeg = (x: number) => wrap(x, 360);

/**
 * The Moon's geocentric longitude and latitude (mean equinox and ecliptic of date, nutation
 * left out) and distance at a Julian ephemeris day.
 */
export function lunarPosition(jde: number): LunarPosition {
  const T = (jde - J2000_JD) / 36_525;
  const T2 = T * T;
  const T3 = T2 * T;
  const T4 = T3 * T;
  /* The mean longitude, elongation, Sun's and Moon's mean anomalies, and the argument of latitude. */
  const Lp = wrapDeg(
    218.3164477 + 481267.88123421 * T - 0.0015786 * T2 + T3 / 538841 - T4 / 65194000,
  );
  const D = wrapDeg(
    297.8501921 + 445267.1114034 * T - 0.0018819 * T2 + T3 / 545868 - T4 / 113065000,
  );
  const M = wrapDeg(357.5291092 + 35999.0502909 * T - 0.0001536 * T2 + T3 / 24490000);
  const Mp = wrapDeg(
    134.9633964 + 477198.8675055 * T + 0.0087414 * T2 + T3 / 69699 - T4 / 14712000,
  );
  const F = wrapDeg(
    93.272095 + 483202.0175233 * T - 0.0036539 * T2 - T3 / 3526000 + T4 / 863310000,
  );
  /* Venus, Jupiter and the Earth's flattening. */
  const A1 = wrapDeg(119.75 + 131.849 * T);
  const A2 = wrapDeg(53.09 + 479264.29 * T);
  const A3 = wrapDeg(313.45 + 481266.484 * T);
  /* The eccentricity of Earth's orbit decreases: terms in M are scaled by E per power. */
  const E = 1 - 0.002516 * T - 0.0000074 * T2;
  const E2 = E * E;
  const scale = (m: number) => (m === 0 ? 1 : Math.abs(m) === 1 ? E : E2);
  let sumL = 0;
  let sumR = 0;
  for (const [d, m, mp, f, l, r] of LONGITUDE_DISTANCE) {
    const arg = (d * D + m * M + mp * Mp + f * F) * RAD;
    const k = scale(m);
    sumL += l * k * Math.sin(arg);
    sumR += r * k * Math.cos(arg);
  }
  let sumB = 0;
  for (const [d, m, mp, f, b] of LATITUDE)
    sumB += b * scale(m) * Math.sin((d * D + m * M + mp * Mp + f * F) * RAD);
  sumL += 3958 * Math.sin(A1 * RAD) + 1962 * Math.sin((Lp - F) * RAD) + 318 * Math.sin(A2 * RAD);
  sumB +=
    -2235 * Math.sin(Lp * RAD) +
    382 * Math.sin(A3 * RAD) +
    175 * Math.sin((A1 - F) * RAD) +
    175 * Math.sin((A1 + F) * RAD) +
    127 * Math.sin((Lp - Mp) * RAD) -
    115 * Math.sin((Lp + Mp) * RAD);
  return {
    longitude: wrapDeg(Lp + sumL / 1e6),
    latitude: sumB / 1e6,
    distanceKm: MEAN_DISTANCE_KM + sumR / 1000,
  };
}

/**
 * The Moon's geocentric place at a date as J2000 ecliptic coordinates, km, written into
 * `out` as [x toward the equinox, y toward longitude 90°, z toward the ecliptic pole]. The
 * longitude of date is brought back by the general precession in longitude (the ecliptic's
 * own drift, under an arcminute a century, is left), so the place agrees with planetary
 * elements referred to J2000 to about an arcminute.
 */
export function lunarPositionJ2000(date: Date, out: Vec3 = [0, 0, 0]): Vec3 {
  const jde = julianEphemerisDay(date);
  const { longitude, latitude, distanceKm } = lunarPosition(jde);
  const T = (jde - J2000_JD) / 36_525;
  /* General precession in longitude from J2000, arcseconds (Meeus 21.6 to first orders). */
  const precession = (5029.0966 * T + 1.11113 * T * T) / 3600;
  const lambda = (longitude - precession) * RAD;
  const beta = latitude * RAD;
  const flat = distanceKm * Math.cos(beta);
  out[0] = flat * Math.cos(lambda);
  out[1] = flat * Math.sin(lambda);
  out[2] = distanceKm * Math.sin(beta);
  return out;
}
