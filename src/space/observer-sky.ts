import {
  EARTH_EQUATORIAL_RADIUS_KM,
  moonAxis,
  moonEcliptic,
  moonPhase,
  solarEcliptic,
} from "@horizon/toolkit/bodies";
import {
  eclipticToEquatorial,
  hourAngle,
  julianEphemerisDay,
  precess,
  RAD_PER_DEG as RAD,
  siderealTime,
  toHorizontal,
} from "@horizon/toolkit/science";

/**
 * The real sky over Ondřejov: the shared bright-star catalogue (`@/space/star-catalogue`),
 * the Sun and the Moon placed on it for the hero and the header. The
 * positional astronomy itself lives in `@horizon/toolkit/science` (sky) and
 * `@horizon/toolkit/bodies` (almanac).
 */
import { STARS, type Star } from "./star-catalogue";

export { starColor } from "./star-catalogue";
/** The sky's clock and rising arcs, for the shell's and the hero's own drawing. */
export { risingHourAngle, siderealTime } from "@horizon/toolkit/science";

/** Ondřejov Observatory, Czech Academy of Sciences. */
export const OBSERVER = { name: "Ondřejov Observatory", latitude: 49.9138, longitude: 14.7822 };

export type Horizontal = { star: Star; altitude: number; azimuth: number };

/** Altitude and azimuth (from north through east) of every star at the moment. */
export function horizontalPositions(date: Date, latitude: number, longitude: number) {
  const lst = siderealTime(date, longitude);
  return STARS.map((star): Horizontal => {
    const p = precess(star[1] * 15, star[2], date);
    return { star, ...toHorizontal(p.ra, p.dec, lst, latitude) };
  });
}

/**
 * The Sun's altitude and azimuth, hour angle and declination, in degrees. No
 * refraction: the disc's centre reaches the line a few minutes after published sunrise
 * (and before published sunset).
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
  const parallax = Math.asin(EARTH_EQUATORIAL_RADIUS_KM / moon.distance);
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
