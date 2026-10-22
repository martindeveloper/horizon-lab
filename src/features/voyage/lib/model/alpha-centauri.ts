/**
 * The α Centauri system as the ship finds it: A where the star catalogue draws Rigil
 * Kentaurus (its direction at its SIMBAD distance), B on its measured orbit about A, and
 * Proxima where its own astrometry puts it today, a fifth of a light-year away. Each star's
 * radius and temperature are the shared catalogue's, so it draws as a disc of the right size
 * and colour. Positions are km, heliocentric, scene axes.
 */
import { Vector3 } from "three";

import { ALPHA_CEN_AB_ORBIT, neighbour, neighbourPosition } from "@/space/galaxy/model/neighbours";
import { STARS } from "@/space/star-catalogue";
import { starDistance } from "@/space/star-distances";
import { NAMED_STARS } from "@/space/stellar";
import { eccentricAnomaly } from "@horizon/toolkit/bodies";
import { TAU } from "@horizon/toolkit/math";
import { equatorialToScene, type Vec3d } from "@horizon/toolkit/scene";
import {
  AU_KM,
  PARSEC_KM,
  RAD_PER_DEG,
  SOLAR_RADIUS_KM,
  julianEpoch,
} from "@horizon/toolkit/science";

export type AlphaCentauriId = "alphaCenA" | "alphaCenB" | "proxima";

export type AlphaCentauriStar = {
  id: AlphaCentauriId;
  /** Photospheric radius, km. */
  radiusKm: number;
  /** Effective temperature, kelvin. */
  kelvin: number;
};

/** Each star's entry in the shared catalogue. */
const CATALOGUED = {
  alphaCenA: NAMED_STARS["alpha-cen-a"],
  alphaCenB: NAMED_STARS["alpha-cen-b"],
  proxima: NAMED_STARS.proxima,
} as const satisfies Record<AlphaCentauriId, unknown>;

const starOf = (id: AlphaCentauriId): AlphaCentauriStar => {
  const { radius, teff } = CATALOGUED[id];
  return { id, radiusKm: radius.value * SOLAR_RADIUS_KM, kelvin: teff.value };
};

export const ALPHA_CENTAURI: readonly AlphaCentauriStar[] = [
  starOf("alphaCenA"),
  starOf("alphaCenB"),
  starOf("proxima"),
];

/**
 * The catalogue's name for the pair: its one point stands for A and B together until the
 * ship comes close enough for the discs to take over.
 */
export const ALPHA_CENTAURI_CATALOGUE_NAME = "Rigil Kentaurus";
const RIGIL = STARS.find(([name]) => name === ALPHA_CENTAURI_CATALOGUE_NAME)!;
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

/** Proxima today, carried from its catalogued place along its proper motion. */
const PROXIMA_AT = new Vector3()
  .fromArray(neighbourPosition(neighbour("proxima"), 0))
  .multiplyScalar(AU_KM);

/**
 * B's offset from A at a Julian year, in au: the Thiele–Innes constants put the orbit on the
 * sky (north, east) and along the line of sight (away from the Sun).
 */
export function companionOffsetAu(year: number) {
  const { periodYr, periastronYr, e, aArcsec, iDeg, omegaDeg, nodeDeg } = ALPHA_CEN_AB_ORBIT;
  const a = aArcsec * A_PC;
  const E = eccentricAnomaly((TAU * (year - periastronYr)) / periodYr, e);
  const X = Math.cos(E) - e;
  const Y = Math.sqrt(1 - e * e) * Math.sin(E);
  const i = iDeg * RAD_PER_DEG;
  const w = omegaDeg * RAD_PER_DEG;
  const node = nodeDeg * RAD_PER_DEG;
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
  const { north, east, away } = companionOffsetAu(julianEpoch(date));
  out[0] += (north * NORTH.x + east * EAST.x + away * AWAY.x) * AU_KM;
  out[1] += (north * NORTH.y + east * EAST.y + away * AWAY.y) * AU_KM;
  out[2] += (north * NORTH.z + east * EAST.z + away * AWAY.z) * AU_KM;
  return out;
}

/** The star a selection of the pair or Proxima flies to: A for the pair. */
export const alphaCentauriStar = (id: AlphaCentauriId) =>
  ALPHA_CENTAURI.find((star) => star.id === id)!;
