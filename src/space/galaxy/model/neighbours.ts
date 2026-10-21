/**
 * The nearest stars, in their real directions and distances today. Their closest approach
 * to the Sun comes from straight-line tracks through their measured positions and
 * velocities, good to a few per cent for about ±300,000 years.
 */
import { equatorialFrameToScene, equatorialToScene, type Vec3 } from "@horizon/toolkit/bodies";
import {
  LIGHT_YEAR_AU,
  PARSEC_AU,
  convert,
  tangentialVelocity,
  RAD_PER_DEG as RAD,
} from "@horizon/toolkit/science";

export type NeighbourId = "proxima" | "alphaCen" | "barnard" | "scholz";

type Neighbour = {
  id: NeighbourId;
  /** Right ascension and declination at epoch J2000.0 (ICRS), degrees. */
  ra: number;
  dec: number;
  /** Parallax in milliarcseconds. */
  parallax: number;
  /** Proper motion μα* (with cos δ) and μδ, mas/yr. */
  pmRa: number;
  pmDec: number;
  /** Radial velocity, km/s, positive receding. */
  rv: number;
  color: string;
  /** Glow size relative to Proxima. */
  weight: number;
};

/**
 * Gaia DR3 astrometry (parallax, proper motion); radial velocities from Gaia DR3
 * (Barnard) and Kervella et al. (2017, Proxima). Alpha Centauri AB is too bright
 * for Gaia: its barycentre, orbital parallax, proper motion and radial velocity
 * are the ALMA values of Akeson et al. (2021). Scholz's star uses the parallax,
 * proper motion and systemic radial velocity of Dupuy et al. (2019).
 * Positions are SIMBAD's, propagated to epoch J2000.0. Gaia DR4 (December 2026) will
 * supersede the DR3 values.
 */
export const NEIGHBOURS: readonly Neighbour[] = [
  {
    id: "proxima",
    ra: 217.4289,
    dec: -62.6795,
    parallax: 768.07,
    pmRa: -3781.74,
    pmDec: 769.47,
    rv: -22.2,
    color: "#ff9c70",
    weight: 1,
  },
  {
    id: "alphaCen",
    ra: 219.8994,
    dec: -60.8354,
    parallax: 750.81,
    pmRa: -3639.95,
    pmDec: 700.4,
    rv: -22.38,
    color: "#fff1d2",
    weight: 1.7,
  },
  {
    id: "barnard",
    ra: 269.4521,
    dec: 4.6933,
    parallax: 546.98,
    pmRa: -801.55,
    pmDec: 10362.39,
    rv: -110.5,
    color: "#ff9a6a",
    weight: 0.9,
  },
  {
    id: "scholz",
    ra: 110.0136,
    dec: -8.7805,
    parallax: 147.1,
    pmRa: -46,
    pmDec: -116.5,
    rv: 82.4,
    color: "#e08a5a",
    weight: 0.8,
  },
];

const PC_AU = PARSEC_AU;
/** The positions' epoch, and the year "today" stands for: the tracks carry them across. */
const POSITION_EPOCH = 2000;
const TODAY_YEAR = 2026;
/** 1 km/s is this many au per year. */
const KMS_AU_YEAR = convert(1, "km/s", "au/yr");

/** Position today (au) and velocity (au/yr), in the scene frame. */
type Track = { p0: Vec3; v: Vec3 };
const tracks = new Map<NeighbourId, Track>();

const dot = (a: Readonly<Vec3>, b: Readonly<Vec3>) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

function trackOf(star: Neighbour): Track {
  let track = tracks.get(star.id);
  if (track) return track;
  const dPc = 1000 / star.parallax;
  const u = equatorialToScene(star.ra, star.dec);
  const a = star.ra * RAD;
  const d = star.dec * RAD;
  // East and north on the sky, in the equatorial frame, then into the scene.
  const east = equatorialFrameToScene(-Math.sin(a), Math.cos(a), 0);
  const north = equatorialFrameToScene(
    -Math.sin(d) * Math.cos(a),
    -Math.sin(d) * Math.sin(a),
    Math.cos(d),
  );
  /* Proper motions are in mas/yr: km/s per mas/yr at this distance. */
  const vt = tangentialVelocity.compute({ mu: 0.001, d: dPc });
  const axis = (k: 0 | 1 | 2) =>
    (u[k] * star.rv + east[k] * vt * star.pmRa + north[k] * vt * star.pmDec) * KMS_AU_YEAR;
  const v: Vec3 = [axis(0), axis(1), axis(2)];
  const dt = TODAY_YEAR - POSITION_EPOCH;
  const at = (k: 0 | 1 | 2) => u[k] * dPc * PC_AU + v[k] * dt;
  track = { p0: [at(0), at(1), at(2)], v };
  tracks.set(star.id, track);
  return track;
}

/** Scene position in au at `yearsAgo`, straight-line motion. */
export function neighbourPosition(star: Neighbour, yearsAgo: number, out: Vec3 = [0, 0, 0]): Vec3 {
  const { p0, v } = trackOf(star);
  out[0] = p0[0] - v[0] * yearsAgo;
  out[1] = p0[1] - v[1] * yearsAgo;
  out[2] = p0[2] - v[2] * yearsAgo;
  return out;
}

export function neighbourDistanceLy(star: Neighbour, yearsAgo: number) {
  const p = neighbourPosition(star, yearsAgo, scratch);
  return Math.hypot(p[0], p[1], p[2]) / LIGHT_YEAR_AU;
}
const scratch: Vec3 = [0, 0, 0];

/** Separation of two neighbours at a moment, au. */
export function neighbourSeparationAu(a: Neighbour, b: Neighbour, yearsAgo: number) {
  const p = neighbourPosition(a, yearsAgo);
  const q = neighbourPosition(b, yearsAgo);
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
}

/** Closest approach of the straight-line track: distance in light-years and when (years ago; negative is future). */
export function closestApproach(star: Neighbour) {
  const { p0, v } = trackOf(star);
  const t = dot(p0, v) / dot(v, v);
  const p = neighbourPosition(star, t);
  return { ly: Math.hypot(p[0], p[1], p[2]) / LIGHT_YEAR_AU, yearsAgo: t };
}

export function neighboursSelfCheck(): string[] {
  const errors: string[] = [];
  const proxima = neighbourDistanceLy(NEIGHBOURS[0]!, 0);
  if (Math.abs(proxima - 4.2465) > 0.01) errors.push(`proxima distance ${proxima}`);
  const scholz = closestApproach(NEIGHBOURS[3]!);
  if (!(scholz.ly > 0.7 && scholz.ly < 1.4 && scholz.yearsAgo > 6e4 && scholz.yearsAgo < 1e5))
    errors.push(`scholz flyby ${scholz.ly} ly ${scholz.yearsAgo} yr`);
  const barnard = closestApproach(NEIGHBOURS[2]!);
  if (!(barnard.yearsAgo < 0 && barnard.yearsAgo > -2e4 && barnard.ly < 4))
    errors.push(`barnard approach ${barnard.ly} ly ${barnard.yearsAgo} yr`);
  return errors;
}
