/**
 * The real sky over Ondřejov: sidereal time, precession and the horizontal
 * positions of the shared bright-star catalogue (`@/lib/stars`).
 */
import { STARS, type Star } from "@/lib/stars";
import { AU_KM, RAD_PER_DEG as RAD } from "@horizon/toolkit/science";

export { STARS, starColor, type Star } from "@/lib/stars";

/** Ondřejov Observatory, Czech Academy of Sciences. */
export const OBSERVER = { name: "Ondřejov Observatory", latitude: 49.9138, longitude: 14.7822 };

/** Greenwich mean sidereal time in degrees (Meeus, eq. 12.4). */
export function siderealTime(date: Date, longitude: number) {
  const jd = date.getTime() / 86400000 + 2440587.5;
  const t = (jd - 2451545.0) / 36525;
  const gmst =
    280.46061837 +
    360.98564736629 * (jd - 2451545.0) +
    0.000387933 * t * t -
    (t * t * t) / 38710000;
  return (((gmst + longitude) % 360) + 360) % 360;
}

/** Rigorous-enough precession from J2000 to the date, in degrees (Meeus, ch. 21). */
export function precess(ra: number, dec: number, date: Date) {
  const t = (date.getTime() / 86400000 + 2440587.5 - 2451545.0) / 36525;
  const zeta = (2306.2181 * t + 0.30188 * t * t) / 3600;
  const z = (2306.2181 * t + 1.09468 * t * t) / 3600;
  const theta = (2004.3109 * t - 0.42665 * t * t) / 3600;
  const a = (ra + zeta) * RAD;
  const d = dec * RAD;
  const th = theta * RAD;
  const A = Math.cos(d) * Math.sin(a);
  const B = Math.cos(th) * Math.cos(d) * Math.cos(a) - Math.sin(th) * Math.sin(d);
  const C = Math.sin(th) * Math.cos(d) * Math.cos(a) + Math.cos(th) * Math.sin(d);
  return { ra: Math.atan2(A, B) / RAD + z, dec: Math.asin(C) / RAD };
}

/** Equatorial (degrees) to altitude and azimuth from north through east, in degrees. */
export function toHorizontal(ra: number, declination: number, lst: number, latitude: number) {
  const lat = latitude * RAD;
  const ha = (lst - ra) * RAD;
  const dec = declination * RAD;
  const sinAlt = Math.sin(dec) * Math.sin(lat) + Math.cos(dec) * Math.cos(lat) * Math.cos(ha);
  const y = Math.sin(ha);
  const x = Math.cos(ha) * Math.sin(lat) - Math.tan(dec) * Math.cos(lat);
  return {
    altitude: Math.asin(sinAlt) / RAD,
    azimuth: (Math.atan2(y, x) / RAD + 180 + 360) % 360,
  };
}

export type Horizontal = { star: Star; altitude: number; azimuth: number };

/** Altitude and azimuth (from north through east) of every star at the moment. */
export function horizontalPositions(date: Date, latitude: number, longitude: number) {
  const lst = siderealTime(date, longitude);
  return STARS.map((star): Horizontal => {
    const p = precess(star[1] * 15, star[2], date);
    return { star, ...toHorizontal(p.ra, p.dec, lst, latitude) };
  });
}

/** Julian ephemeris day; ΔT ≈ 69 s around 2026 (TT − UT). */
export function julianEphemerisDay(date: Date) {
  return (date.getTime() + 69_000) / 86400000 + 2440587.5;
}

/**
 * The Sun's apparent ecliptic longitude (degrees) and distance (AU) from the
 * low-precision Astronomical Almanac series, about 0.01° from 1950 to 2050.
 */
export function solarEcliptic(jde: number) {
  const d = jde - 2451545.0;
  const g = (357.529 + 0.98560028 * d) * RAD;
  return {
    longitude: 280.459 + 0.98564736 * d + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g),
    distance: 1.00014 - 0.01671 * Math.cos(g) - 0.00014 * Math.cos(2 * g),
    obliquity: 23.439 - 0.00000036 * d,
  };
}

export function eclipticToEquatorial(longitude: number, latitude: number, obliquity: number) {
  const l = longitude * RAD;
  const b = latitude * RAD;
  const e = obliquity * RAD;
  const ra = Math.atan2(Math.sin(l) * Math.cos(e) - Math.tan(b) * Math.sin(e), Math.cos(l)) / RAD;
  const dec = Math.asin(Math.sin(b) * Math.cos(e) + Math.cos(b) * Math.sin(e) * Math.sin(l)) / RAD;
  return { ra, dec };
}

/** Hour angle in degrees, −180…180: negative east of the meridian, rising; positive west, setting. */
export function hourAngle(lst: number, ra: number) {
  return ((((lst - ra + 180) % 360) + 360) % 360) - 180;
}

/**
 * The hour angle, in degrees, at which a body of this declination crosses the
 * altitude `horizon`: half its time above it, as an angle of the sky's turn.
 * 0 for a body that never rises, 180 for one that never sets.
 */
export function risingHourAngle(declination: number, latitude: number, horizon = 0) {
  const lat = latitude * RAD;
  const dec = declination * RAD;
  const cos =
    (Math.sin(horizon * RAD) - Math.sin(lat) * Math.sin(dec)) / (Math.cos(lat) * Math.cos(dec));
  return Math.acos(Math.max(-1, Math.min(1, cos))) / RAD;
}

/**
 * The Sun's altitude and azimuth, hour angle and declination, in degrees. No
 * refraction: the disc sits on the line a few minutes before published sunrise.
 */
export function sunPosition(date: Date, latitude: number, longitude: number) {
  const sun = solarEcliptic(julianEphemerisDay(date));
  const { ra, dec } = eclipticToEquatorial(sun.longitude, 0, sun.obliquity);
  const lst = siderealTime(date, longitude);
  return {
    ...toHorizontal(ra, dec, lst, latitude),
    hourAngle: hourAngle(lst, ra),
    declination: dec,
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
  const t = (jde - 2451545.0) / 36525;
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

const EARTH_RADIUS_KM = 6378.14;

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
 * Initial bearing on the sky from one horizontal position to another, in
 * degrees from the zenith towards increasing azimuth.
 */
function skyBearing(fromAz: number, fromAlt: number, toAz: number, toAlt: number) {
  const h1 = fromAlt * RAD;
  const h2 = toAlt * RAD;
  const dAz = (toAz - fromAz) * RAD;
  return (
    Math.atan2(
      Math.sin(dAz) * Math.cos(h2),
      Math.cos(h1) * Math.sin(h2) - Math.sin(h1) * Math.cos(h2) * Math.cos(dAz),
    ) / RAD
  );
}

/** Mean inclination of the lunar equator to the ecliptic (Meeus ch. 53). */
const LUNAR_EQUATOR = 1.54242;

/**
 * Position angle of the Moon's rotation axis, east of celestial north, in
 * degrees (Meeus 53.1 and the following, without nutation or physical
 * libration: within about 0.2°).
 */
export function moonAxis(jde: number) {
  const t = (jde - 2451545.0) / 36525;
  const node = (125.0445479 - 1934.1362891 * t + 0.0020754 * t * t) * RAD;
  const moon = moonEcliptic(jde);
  const obliquity = solarEcliptic(jde).obliquity * RAD;
  const i = LUNAR_EQUATOR * RAD;
  const w = moon.longitude * RAD - node;
  const beta = moon.latitude * RAD;
  const b = Math.asin(-Math.sin(w) * Math.cos(beta) * Math.sin(i) - Math.sin(beta) * Math.cos(i));
  const x = Math.sin(i) * Math.sin(node);
  const y = Math.sin(i) * Math.cos(node) * Math.cos(obliquity) - Math.cos(i) * Math.sin(obliquity);
  const omega = Math.atan2(x, y);
  const ra = eclipticToEquatorial(moon.longitude, moon.latitude, obliquity / RAD).ra * RAD;
  return Math.asin((Math.hypot(x, y) * Math.cos(ra - omega)) / Math.cos(b)) / RAD;
}

/**
 * Where the Moon stands for an observer and how it is lit: topocentric
 * altitude (parallax up to ~1° applied, no refraction), azimuth, geocentric
 * hour angle and declination, illuminated
 * fraction, the bearing of its bright limb (the direction of the Sun), and the
 * bearing of its north pole. Bearings are measured on the sky from the zenith
 * towards increasing azimuth, i.e. clockwise in a view facing south.
 */
export function moonPosition(date: Date, latitude: number, longitude: number) {
  const jde = julianEphemerisDay(date);
  const moon = moonEcliptic(jde);
  const sun = solarEcliptic(jde);
  const lst = siderealTime(date, longitude);
  const eq = eclipticToEquatorial(moon.longitude, moon.latitude, sun.obliquity);
  const geo = toHorizontal(eq.ra, eq.dec, lst, latitude);
  const parallax = Math.asin(EARTH_RADIUS_KM / moon.distance);
  const altitude =
    geo.altitude - Math.asin(Math.sin(parallax) * Math.cos(geo.altitude * RAD)) / RAD;
  const solar = eclipticToEquatorial(sun.longitude, 0, sun.obliquity);
  const s = toHorizontal(solar.ra, solar.dec, lst, latitude);
  const limb = skyBearing(geo.azimuth, altitude, s.azimuth, s.altitude);
  // Celestial north is the bearing of the pole; the axis sits P east (anticlockwise) of it.
  const north = skyBearing(geo.azimuth, altitude, 0, latitude) - moonAxis(jde);
  return {
    altitude,
    azimuth: geo.azimuth,
    hourAngle: hourAngle(lst, eq.ra),
    declination: eq.dec,
    limb,
    north,
    ...moonPhase(jde),
  };
}
