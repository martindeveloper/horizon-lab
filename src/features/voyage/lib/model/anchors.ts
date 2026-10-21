/**
 * Everything the ship can park at or fly to: the solar system's bodies, α Centauri A where the
 * star sky draws it (`alpha-centauri.ts`: the catalogue's direction at its SIMBAD distance, so
 * the parked ship looks at the star itself), the Galaxy seen from above, Andromeda, and the
 * edge of what can ever be reached. Each anchor has a place at a moment in km (heliocentric, scene axes) and a radius
 * that frames an arrival and keeps the ship off it.
 */
import { Vector3 } from "three";

import { anchorById, anchorToday } from "@/space/cosmos/model/cosmos";
import { cosmicToWorld, galaxyToWorld } from "@/space/galaxy/scene/frames";
import { MOON_IDS, NAMED, PLANET_IDS, type BodyId } from "@horizon/toolkit/bodies";
import { includesId } from "@horizon/toolkit/records";
import type { Vec3d } from "@horizon/toolkit/scene";
import { AU_KM, LIGHT_YEAR_KM } from "@horizon/toolkit/science";

import { alphaCentauriAt, alphaCentauriStar } from "./alpha-centauri";
import { bodyPositionKm, radiusKm } from "./bodies";
import { EDGE_LY } from "./comoving";

/** The places beyond the solar system the ship can go. */
type FarAnchorId = "alphaCen" | "galacticCentre" | "andromeda" | "edge";

export type AnchorId = BodyId | FarAnchorId;

const BODY_IDS: readonly BodyId[] = ["sun", ...PLANET_IDS, ...NAMED.map((b) => b.id), ...MOON_IDS];

export const FAR_ANCHOR_IDS: readonly FarAnchorId[] = [
  "alphaCen",
  "galacticCentre",
  "andromeda",
  "edge",
];

export const isBodyAnchor = (id: AnchorId): id is BodyId => includesId(BODY_IDS, id);

/**
 * Radii that frame an arrival and keep the ship off, km: α Centauri A's photosphere, the
 * Galaxy seen whole from above its disk, a galaxy's disc, the edge's horizon.
 */
const FAR_RADIUS_KM: Readonly<Record<FarAnchorId, number>> = {
  alphaCen: alphaCentauriStar("alphaCenA").radiusKm,
  galacticCentre: 5e4 * LIGHT_YEAR_KM,
  andromeda: 1.1e5 * LIGHT_YEAR_KM,
  edge: 1e9 * LIGHT_YEAR_KM,
};

/** The anchor's radius, km. */
export const anchorRadius = (id: AnchorId) => (isBodyAnchor(id) ? radiusKm(id) : FAR_RADIUS_KM[id]);

const v = new Vector3();

/**
 * The north galactic pole, unit, scene axes (the frame helper places points, so the pole is
 * the difference of two): the edge lies that way, and the Galaxy is seen from it.
 */
export const GALACTIC_NORTH = galaxyToWorld(0, 1, 0, new Vector3())
  .sub(galaxyToWorld(0, 0, 0, new Vector3()))
  .normalize();

/**
 * Where an anchor is at `date`, km, heliocentric. The far places stand where they are today
 * (the cosmic map in comoving positions; the host scales it by the universe's expansion).
 */
export function anchorAt(id: AnchorId, date: Date, out: Vec3d): Vec3d {
  if (isBodyAnchor(id)) return bodyPositionKm(id, date, out);
  if (id === "alphaCen") return alphaCentauriAt("alphaCenA", date, out);
  if (id === "galacticCentre") galaxyToWorld(0, 0, 0, v);
  else if (id === "andromeda") cosmicToWorld(anchorToday(anchorById("andromeda")), v);
  else v.copy(GALACTIC_NORTH).multiplyScalar((EDGE_LY * LIGHT_YEAR_KM) / AU_KM);
  out[0] = v.x * AU_KM;
  out[1] = v.y * AU_KM;
  out[2] = v.z * AU_KM;
  return out;
}

/** The message key naming an anchor: the shared names where they exist, Voyage's own for the rest. */
export function anchorNameKey(id: AnchorId) {
  if (isBodyAnchor(id) || id === "alphaCen" || id === "andromeda") return `names.${id}`;
  return `anchors.${id}`;
}
