/**
 * The α Centauri system as the ship finds it: A where the star catalogue draws Rigil
 * Kentaurus (its direction at its SIMBAD distance), B on its measured orbit about A, and
 * Proxima at its own catalogued place a fifth of a light-year away. Each star has a measured
 * radius and temperature, so it draws as a disc of the right size and colour.
 * Positions are km, heliocentric, scene axes.
 */
import { Vector3 } from "three";

import { STARS } from "@/space/star-catalogue";
import { SUN_RADIUS_KM } from "@horizon/toolkit/bodies";
import { equatorialToScene, type Vec3d } from "@horizon/toolkit/scene";
import { AU_KM, PARSEC_KM } from "@horizon/toolkit/science";

import { starDistance } from "./star-distances";

export type AlphaCentauriId = "alphaCenA" | "alphaCenB" | "proxima";

export type AlphaCentauriStar = {
  id: AlphaCentauriId;
  /** Photospheric radius, km. */
  radiusKm: number;
  /** Effective temperature, kelvin. */
  kelvin: number;
};

/**
 * A and B: radii 1.2234 and 0.8632 R☉ from VLTI interferometry and temperatures 5795 and
 * 5231 K (Kervella et al. 2017, A&A 597, A137). Proxima: 0.1542 R☉ (Mann et al. 2015's
 * mass–radius relation, as adopted by Kervella et al. 2017, A&A 598, L7) and 3042 K
 * (Ségransan et al. 2003, A&A 397, L5).
 */
export const ALPHA_CENTAURI: readonly AlphaCentauriStar[] = [
  { id: "alphaCenA", radiusKm: 1.2234 * SUN_RADIUS_KM, kelvin: 5795 },
  { id: "alphaCenB", radiusKm: 0.8632 * SUN_RADIUS_KM, kelvin: 5231 },
  { id: "proxima", radiusKm: 0.1542 * SUN_RADIUS_KM, kelvin: 3042 },
];

/**
 * The visual orbit of B about A (Pourbaix et al. 2002, A&A 386, 280): period in years,
 * periastron epoch (Julian year), eccentricity, semi-major axis in arcseconds, and the
 * inclination, argument of periastron and node in degrees.
 */
export const AB_ORBIT = {
  periodYr: 79.91,
  periastronYr: 1875.66,
  e: 0.5179,
  aArcsec: 17.57,
  iDeg: 79.205,
  omegaDeg: 231.65,
  nodeDeg: 204.85,
} as const;

/** Proxima's J2000 place: 14h 29m 42.95s, −62° 40′ 46.1″, parallax 768.07 mas (Gaia DR3). */
const PROXIMA = { raHours: 14.495264, decDeg: -62.679486, pc: 1000 / 768.07 } as const;

const RIGIL = STARS.find(([name]) => name === "Rigil Kentaurus")!;
const A_PC = starDistance(RIGIL[0]);

/** A's place, and the sky's north and east there (scene axes), from the catalogue direction. */
const A_AT = equatorialToScene(RIGIL[1] * 15, RIGIL[2], new Vector3()).multiplyScalar(
  A_PC * PARSEC_KM,
);
const STEP_DEG = 0.01;
const NORTH = equatorialToScene(RIGIL[1] * 15, RIGIL[2] + STEP_DEG, new Vector3())
  .sub(equatorialToScene(RIGIL[1] * 15, RIGIL[2], new Vector3()))
  .normalize();
const EAST = equatorialToScene(RIGIL[1] * 15 + STEP_DEG, RIGIL[2], new Vector3())
  .sub(equatorialToScene(RIGIL[1] * 15, RIGIL[2], new Vector3()))
  .normalize();
const AWAY = A_AT.clone().normalize();

const PROXIMA_AT = equatorialToScene(
  PROXIMA.raHours * 15,
  PROXIMA.decDeg,
  new Vector3(),
).multiplyScalar(PROXIMA.pc * PARSEC_KM);

const J2000_MS = Date.UTC(2000, 0, 1, 12);
const YEAR_MS = 365.25 * 86_400_000;
const rad = (deg: number) => (deg * Math.PI) / 180;

/** Kepler's equation by Newton's method: the eccentric anomaly for a mean anomaly. */
function eccentricAnomaly(meanAnomaly: number, e: number) {
  let E = meanAnomaly;
  for (let i = 0; i < 12; i += 1) {
    const d = (E - e * Math.sin(E) - meanAnomaly) / (1 - e * Math.cos(E));
    E -= d;
    if (Math.abs(d) < 1e-12) break;
  }
  return E;
}

/**
 * B's offset from A at a Julian year, in au: the Thiele–Innes constants put the orbit on the
 * sky (north, east) and along the line of sight (away from the Sun).
 */
export function companionOffsetAu(year: number) {
  const { periodYr, periastronYr, e, aArcsec, iDeg, omegaDeg, nodeDeg } = AB_ORBIT;
  const a = aArcsec * A_PC;
  const M = ((2 * Math.PI * (year - periastronYr)) / periodYr) % (2 * Math.PI);
  const E = eccentricAnomaly(M, e);
  const X = Math.cos(E) - e;
  const Y = Math.sqrt(1 - e * e) * Math.sin(E);
  const i = rad(iDeg);
  const w = rad(omegaDeg);
  const node = rad(nodeDeg);
  const A = a * (Math.cos(node) * Math.cos(w) - Math.sin(node) * Math.sin(w) * Math.cos(i));
  const B = a * (Math.sin(node) * Math.cos(w) + Math.cos(node) * Math.sin(w) * Math.cos(i));
  const F = a * (-Math.cos(node) * Math.sin(w) - Math.sin(node) * Math.cos(w) * Math.cos(i));
  const G = a * (-Math.sin(node) * Math.sin(w) + Math.cos(node) * Math.cos(w) * Math.cos(i));
  return {
    north: A * X + F * Y,
    east: B * X + G * Y,
    away: a * Math.sin(i) * (X * Math.sin(w) + Y * Math.cos(w)),
  };
}

/** The Julian year of a date. */
export const julianYear = (date: Date) => 2000 + (date.getTime() - J2000_MS) / YEAR_MS;

/** Where a star of the system is at `date`, km, heliocentric. */
export function alphaCentauriAt(id: AlphaCentauriId, date: Date, out: Vec3d): Vec3d {
  if (id === "proxima") {
    out[0] = PROXIMA_AT.x;
    out[1] = PROXIMA_AT.y;
    out[2] = PROXIMA_AT.z;
    return out;
  }
  out[0] = A_AT.x;
  out[1] = A_AT.y;
  out[2] = A_AT.z;
  if (id === "alphaCenA") return out;
  const { north, east, away } = companionOffsetAu(julianYear(date));
  out[0] += (north * NORTH.x + east * EAST.x + away * AWAY.x) * AU_KM;
  out[1] += (north * NORTH.y + east * EAST.y + away * AWAY.y) * AU_KM;
  out[2] += (north * NORTH.z + east * EAST.z + away * AWAY.z) * AU_KM;
  return out;
}

/** The star a selection of the pair or Proxima flies to: A for the pair. */
export const alphaCentauriStar = (id: AlphaCentauriId) =>
  ALPHA_CENTAURI.find((star) => star.id === id)!;
