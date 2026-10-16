/**
 * The bodies' figures and spin axes: what a lab needs to draw each one the
 * right size, shape and way up. Orbits live in ephemeris.ts, the moons' in
 * moons.ts, ring systems in rings.ts.
 *
 * Poles and prime meridians are the IAU WGCCRE 2015 recommendations (Archinal
 * et al. 2018, Celest. Mech. Dyn. Astron. 130, 22): the north pole as ICRF
 * J2000 right ascension and declination, and W, the prime meridian's angle east
 * of the equator's ascending node, W = W₀ + Ẇ d, d in days from J2000. A
 * retrograde rotator (Venus, Uranus) has Ẇ < 0; Pluto uses the right-hand pole.
 * Radii are the same report's (1-bar level for the giants).
 */
import { recordBy } from "../records";
import { J2000_JD, julianDay } from "../science";
import {
  PLANET_RADIUS_KM,
  SUN_RADIUS_KM,
  namedById,
  type NamedId,
  type PlanetId,
} from "./ephemeris";
import { equatorialToScene, quaternionFromBasis, turnAboutY, type Quat, type Vec3 } from "./frames";
import { MOONS, type MoonId } from "./moons";

export type BodyId = "sun" | PlanetId | NamedId | MoonId;
/** Bodies with an IAU spin model; moons turn synchronously with their orbits. */
export type SpinningId = Exclude<BodyId, MoonId>;

export type Figure = {
  /** IAU mean radius, km. */
  meanKm: number;
  equatorialKm: number;
  polarKm: number;
};

export type Spin = {
  /** North pole α₀, δ₀ (degrees) at a Julian century T from J2000. */
  pole: (T: number) => readonly [ra: number, dec: number];
  /** Prime meridian W (degrees) at d days from J2000. */
  meridian: (d: number) => number;
};

const sphere = (km: number): Figure => ({ meanKm: km, equatorialKm: km, polarKm: km });
const fixed =
  (ra: number, dec: number): Spin["pole"] =>
  () => [ra, dec];
const turning =
  (w0: number, rate: number): Spin["meridian"] =>
  (d) =>
    w0 + rate * d;
/** Rotation rate in degrees per day for a sidereal period in hours (negative: retrograde). */
const perHours = (hours: number) => (360 * 24) / hours;
const RAD = Math.PI / 180;
/** Neptune's pole precesses on a 3.4 kyr cone; N is that angle (IAU 2015). */
const neptuneN = (T: number) => (357.85 + 52.316 * T) * RAD;

/** Mean radii come from ephemeris.ts and moons.ts; shapes are the IAU's. */
export const FIGURES: Record<BodyId, Figure> = {
  /** Nominal solar radius, IAU 2015 Resolution B3. */
  sun: sphere(SUN_RADIUS_KM),
  mercury: { meanKm: PLANET_RADIUS_KM.mercury, equatorialKm: 2440.53, polarKm: 2438.26 },
  venus: sphere(PLANET_RADIUS_KM.venus),
  earth: { meanKm: PLANET_RADIUS_KM.earth, equatorialKm: 6378.1366, polarKm: 6356.7519 },
  mars: { meanKm: PLANET_RADIUS_KM.mars, equatorialKm: 3396.19, polarKm: 3376.2 },
  jupiter: { meanKm: PLANET_RADIUS_KM.jupiter, equatorialKm: 71_492, polarKm: 66_854 },
  saturn: { meanKm: PLANET_RADIUS_KM.saturn, equatorialKm: 60_268, polarKm: 54_364 },
  uranus: { meanKm: PLANET_RADIUS_KM.uranus, equatorialKm: 25_559, polarKm: 24_973 },
  neptune: { meanKm: PLANET_RADIUS_KM.neptune, equatorialKm: 24_764, polarKm: 24_341 },
  pluto: sphere(namedById("pluto").radiusKm),
  sedna: sphere(namedById("sedna").radiusKm),
  halley: sphere(namedById("halley").radiusKm),
  ...recordBy(
    MOONS,
    (moon) => moon.id,
    (moon) => sphere(moon.radiusKm),
  ),
};

export const SPINS: Record<SpinningId, Spin> = {
  sun: { pole: fixed(286.13, 63.87), meridian: turning(84.176, 14.1844) },
  mercury: {
    pole: (T) => [281.0103 - 0.0328 * T, 61.4155 - 0.0049 * T],
    meridian: turning(329.5988, 6.1385108),
  },
  /** Ẇ from Margot et al. 2021 (Nature Astronomy 5, 676): 243.0226 ± 0.0013 days, retrograde. */
  venus: { pole: fixed(272.76, 67.16), meridian: turning(160.2, perHours(-243.0226 * 24)) },
  earth: {
    pole: (T) => [-0.641 * T, 90 - 0.557 * T],
    meridian: turning(190.147, 360.9856235),
  },
  /** Mars's 2015 pole series (secular and long-period terms) evaluated at J2000; by 2026 it has moved ~0.03°. */
  mars: { pole: fixed(317.681, 52.886), meridian: turning(176.049863, 350.891982443297) },
  jupiter: {
    pole: (T) => [268.056595 - 0.006499 * T, 64.495303 + 0.002413 * T],
    meridian: turning(284.95, 870.536),
  },
  /** Interior rotation from ring seismology, Mankovich et al. 2019 (ApJ 871, 1): 10 h 33 m 38 s. */
  saturn: {
    pole: (T) => [40.589 - 0.036 * T, 83.537 - 0.004 * T],
    meridian: turning(38.9, perHours(10 + 33 / 60 + 38 / 3600)),
  },
  /** Ẇ from Hubble auroral tracking, Lamy et al. 2025 (Nature Astronomy 9, 658): 17.247864 h. */
  uranus: { pole: fixed(257.311, -15.175), meridian: turning(203.81, perHours(-17.247864)) },
  /** Ẇ is Karkoschka's 2011 cloud-feature period, 15.9663 h (Voyager's radio period was 16.11 h). */
  neptune: {
    pole: (T) => [299.36 + 0.7 * Math.sin(neptuneN(T)), 43.46 - 0.51 * Math.cos(neptuneN(T))],
    meridian: (d) => 249.978 + 541.1397757 * d - 0.48 * Math.sin(neptuneN(d / 36525)),
  },
  pluto: { pole: fixed(132.993, -6.163), meridian: turning(302.695, 56.3625225) },
  /** Pole unknown; light curve period 10.27 h (Gaudi et al. 2005, ApJ 629, L49). */
  sedna: { pole: fixed(270, 66.56), meridian: turning(0, perHours(10.27)) },
  /** Complex, non-principal-axis rotation (Belton et al. 1991); drawn turning once per 2.2 d, a teaching choice. */
  halley: { pole: fixed(270, 66.56), meridian: turning(0, perHours(52.8)) },
};

/** Polar over equatorial radius, for the oblate giants. */
export const flattening = (id: BodyId) => 1 - FIGURES[id].polarKm / FIGURES[id].equatorialKm;

/** Spin pole as a scene-frame unit vector. */
export function poleVector(id: SpinningId, T: number, out: Vec3 = [0, 0, 0]): Vec3 {
  const [ra, dec] = SPINS[id].pole(T);
  return equatorialToScene(ra, dec, out);
}

const node: Vec3 = [0, 0, 0];
const east: Vec3 = [0, 0, 0];
const west: Vec3 = [0, 0, 0];
const pole: Vec3 = [0, 0, 0];

/**
 * Orientation of a unit sphere whose texture u = east longitude / 360 starts
 * at local −X (three.js SphereGeometry): local +Y is the north pole and the
 * prime meridian sits W east of the equator's ascending node on the ICRF
 * equator, so the painted longitudes face where they really do.
 */
export function bodyOrientation(id: SpinningId, date: Date, out: Quat = [0, 0, 0, 1]): Quat {
  const d = julianDay(date) - J2000_JD;
  const [ra, dec] = SPINS[id].pole(d / 36525);
  equatorialToScene(ra, dec, pole);
  /* The equator's ascending node on the ICRF equator lies at α₀ + 90° (exact even for Earth). */
  equatorialToScene(ra + 90, 0, node);
  east[0] = pole[1] * node[2] - pole[2] * node[1];
  east[1] = pole[2] * node[0] - pole[0] * node[2];
  east[2] = pole[0] * node[1] - pole[1] * node[0];
  west[0] = -node[0];
  west[1] = -node[1];
  west[2] = -node[2];
  quaternionFromBasis(west, pole, east, out);
  const W = SPINS[id].meridian(d) % 360;
  return turnAboutY(out, W * RAD);
}
