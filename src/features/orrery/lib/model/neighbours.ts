/**
 * The nearest stars, in their real directions, moved in straight lines from
 * their measured positions and velocities. Good to a few per cent for about
 * ±300,000 years; beyond that the straight line and the sketch are hidden.
 */
import { Vector3 } from "three";

import { LIGHT_YEAR_AU, PARSEC_AU, convert, tangentialVelocity } from "@horizon/toolkit/science";

import { equatorialToScene, equatorialFrameToScene } from "../graphics/coordinates";

export type NeighbourId = "proxima" | "alphaCen" | "barnard" | "scholz";

export type Neighbour = {
  id: NeighbourId;
  /** J2000 right ascension and declination, degrees. */
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
 * Gaia DR4 (December 2026) will supersede the DR3 values.
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

const RAD = Math.PI / 180;
const PC_AU = PARSEC_AU;
/** 1 km/s is this many au per year. */
const KMS_AU_YEAR = convert(1, "km/s", "au/yr");

/** Within this the straight-line sketch is drawn. */
export const NEIGHBOUR_WINDOW = 3e5;

type Track = { p0: Vector3; v: Vector3 };
const tracks = new Map<NeighbourId, Track>();

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
  const v = new Vector3()
    .addScaledVector(u, star.rv)
    .addScaledVector(east, vt * star.pmRa)
    .addScaledVector(north, vt * star.pmDec)
    .multiplyScalar(KMS_AU_YEAR);
  track = { p0: u.multiplyScalar(dPc * PC_AU), v };
  tracks.set(star.id, track);
  return track;
}

/** Scene position in AU at `yearsAgo`, straight-line motion. */
export function neighbourPosition(star: Neighbour, yearsAgo: number, out = new Vector3()) {
  const { p0, v } = trackOf(star);
  return out.copy(p0).addScaledVector(v, -yearsAgo);
}

export function neighbourDistanceLy(star: Neighbour, yearsAgo: number) {
  const { p0, v } = trackOf(star);
  return (
    Math.hypot(p0.x - v.x * yearsAgo, p0.y - v.y * yearsAgo, p0.z - v.z * yearsAgo) / LIGHT_YEAR_AU
  );
}

/** The nearest of the four at a moment. */
export function nearestNeighbour(yearsAgo: number) {
  let best = NEIGHBOURS[0]!;
  let bestD = Infinity;
  for (const star of NEIGHBOURS) {
    const d = neighbourDistanceLy(star, yearsAgo);
    if (d < bestD) {
      bestD = d;
      best = star;
    }
  }
  return { star: best, ly: bestD };
}

/** Closest approach of the straight-line track: distance in light-years and when (years ago; negative is future). */
export function closestApproach(star: Neighbour) {
  const { p0, v } = trackOf(star);
  const t = p0.dot(v) / v.lengthSq();
  const p = new Vector3().copy(p0).addScaledVector(v, -t);
  return { ly: p.length() / LIGHT_YEAR_AU, yearsAgo: t };
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
