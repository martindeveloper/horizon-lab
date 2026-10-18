/**
 * Positional astronomy for an observer on Earth: sidereal time, precession and
 * the ecliptic → equatorial → horizontal chain (Meeus, Astronomical
 * Algorithms, 2nd ed., 1998). Angles are degrees; azimuth runs from north
 * through east. No nutation, aberration or refraction.
 */
import { RAD_PER_DEG as RAD } from "./constants";
import { J2000_JD, JULIAN_CENTURY_DAYS, julianDay } from "./time";

/** Local mean sidereal time in degrees, 0…360, at an east longitude (Meeus 12.4). */
export function siderealTime(date: Date, longitude: number) {
  const jd = julianDay(date);
  const t = (jd - J2000_JD) / JULIAN_CENTURY_DAYS;
  const gmst =
    280.46061837 + 360.98564736629 * (jd - J2000_JD) + 0.000387933 * t * t - (t * t * t) / 38710000;
  return (((gmst + longitude) % 360) + 360) % 360;
}

/** J2000 right ascension and declination precessed to the date (Meeus 21.2–21.4). */
export function precess(ra: number, dec: number, date: Date) {
  const t = (julianDay(date) - J2000_JD) / JULIAN_CENTURY_DAYS;
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

/** Ecliptic longitude and latitude to right ascension and declination (Meeus 13.3–13.4). */
export function eclipticToEquatorial(longitude: number, latitude: number, obliquity: number) {
  const l = longitude * RAD;
  const b = latitude * RAD;
  const e = obliquity * RAD;
  const ra = Math.atan2(Math.sin(l) * Math.cos(e) - Math.tan(b) * Math.sin(e), Math.cos(l)) / RAD;
  const dec = Math.asin(Math.sin(b) * Math.cos(e) + Math.cos(b) * Math.sin(e) * Math.sin(l)) / RAD;
  return { ra, dec };
}

/** Right ascension and declination to altitude and azimuth at a local sidereal time (Meeus 13.5–13.6). */
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

/** Hour angle in degrees, −180…180: negative east of the meridian, rising; positive west, setting. */
export function hourAngle(lst: number, ra: number) {
  return ((((lst - ra + 180) % 360) + 360) % 360) - 180;
}

/**
 * The hour angle, in degrees, at which a body of this declination crosses the
 * altitude `horizon` (Meeus 15.1): half its time above it, as an angle of the
 * sky's turn. 0 for a body that never rises, 180 for one that never sets.
 */
export function risingHourAngle(declination: number, latitude: number, horizon = 0) {
  const lat = latitude * RAD;
  const dec = declination * RAD;
  const cos =
    (Math.sin(horizon * RAD) - Math.sin(lat) * Math.sin(dec)) / (Math.cos(lat) * Math.cos(dec));
  return Math.acos(Math.max(-1, Math.min(1, cos))) / RAD;
}

/** The north galactic pole and the galactic longitude of the north celestial pole, J2000. */
const GALACTIC_POLE = { ra: 192.85948, dec: 27.12825, lNcp: 122.93192 };

/** J2000 right ascension and declination to galactic longitude (0…360) and latitude. */
export function equatorialToGalactic(ra: number, dec: number) {
  const d = dec * RAD;
  const dp = GALACTIC_POLE.dec * RAD;
  const da = (ra - GALACTIC_POLE.ra) * RAD;
  const b = Math.asin(Math.sin(d) * Math.sin(dp) + Math.cos(d) * Math.cos(dp) * Math.cos(da));
  const y = Math.cos(d) * Math.sin(da);
  const x = Math.sin(d) * Math.cos(dp) - Math.cos(d) * Math.sin(dp) * Math.cos(da);
  const l = GALACTIC_POLE.lNcp - Math.atan2(y, x) / RAD;
  return { l: ((l % 360) + 360) % 360, b: b / RAD };
}
