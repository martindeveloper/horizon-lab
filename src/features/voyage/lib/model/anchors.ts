/**
 * Everything the ship can orbit or fly to: the solar system's bodies, the five probes leaving
 * it where their JPL tracks put them, α Centauri A where the star sky draws it
 * (`alpha-centauri.ts`: the catalogue's direction at its SIMBAD distance, so the ship looks at
 * the star itself), B on its orbit about A (reached by hand, not listed) and Proxima, the
 * Galaxy seen from above, the Magellanic Clouds, Andromeda,
 * Triangulum, the Virgo Cluster, and the edge of what can ever be reached. Each anchor has a
 * place at a moment in km (heliocentric, scene axes) and a radius that frames an arrival and
 * keeps the ship off it. The far places stand where the cosmic map has them today, and those
 * beyond the Local Group recede with the expansion by the map's own rule (`expansionAt`).
 */
import { Vector3 } from "three";

import { COSMOS } from "@/space/cosmos/model/catalogue";
import { EVENT_HORIZON_LY, anchorById, anchorToday } from "@/space/cosmos/model/cosmos";
import { GALAXY } from "@/space/galaxy/model/catalogue/galaxy";
import { cosmicToWorld, galaxyToWorld } from "@/space/galaxy/scene/frames";
import type { WorldSelection } from "@/space/galaxy/show";
import { PROBES, probePosition, yearOf, type ProbeId } from "@/space/solar-system/model/probes";
import { hasSurface, isSolarSelection } from "@/space/solar-system/model/selection";
import { MOON_IDS, NAMED, PLANET_IDS, type BodyId } from "@horizon/toolkit/bodies";
import { includesId } from "@horizon/toolkit/records";
import { lengthVec3d, vec3d, type Vec3d } from "@horizon/toolkit/scene";
import { AU_KM, LIGHT_YEAR_KM } from "@horizon/toolkit/science";

import { alphaCentauriAt, alphaCentauriStar } from "./alpha-centauri";
import { bodyPositionKm, radiusKm, selectionOfBody, worldBody } from "./bodies";
import { expansionAt } from "./comoving";

/** The galaxies and the cluster the ship can go to, placed by the cosmic map. */
type GalaxyAnchorId = "lmc" | "smc" | "andromeda" | "triangulum" | "virgoCluster";

/** The places beyond the planets the ship can go. */
type FarAnchorId =
  | ProbeId
  | "alphaCen"
  | "alphaCenB"
  | "proxima"
  | "galacticCentre"
  | GalaxyAnchorId
  | "edge";

export type AnchorId = BodyId | FarAnchorId;

const BODY_IDS: readonly BodyId[] = ["sun", ...PLANET_IDS, ...NAMED.map((b) => b.id), ...MOON_IDS];

export const PROBE_ANCHOR_IDS: readonly ProbeId[] = PROBES.map((p) => p.id);
export const STAR_ANCHOR_IDS = ["alphaCen", "proxima"] as const;
export const GALAXY_ANCHOR_IDS: readonly (GalaxyAnchorId | "galacticCentre" | "edge")[] = [
  "galacticCentre",
  "lmc",
  "smc",
  "andromeda",
  "triangulum",
  "virgoCluster",
  "edge",
];

/** The far places the destinations list: everything beyond the solar system but B. */
export const FAR_ANCHOR_IDS: readonly FarAnchorId[] = [
  ...PROBE_ANCHOR_IDS,
  ...STAR_ANCHOR_IDS,
  ...GALAXY_ANCHOR_IDS,
];

const isProbe = (id: AnchorId): id is ProbeId => includesId(PROBE_ANCHOR_IDS, id);

export const isBodyAnchor = (id: AnchorId): id is BodyId => includesId(BODY_IDS, id);

/**
 * Whether a drive can take the ship there. The edge stands on the cosmic event horizon, and
 * nothing that leaves Earth today ever gets that far, even at light speed: the ship can only
 * be put there, and its trips there take forever.
 */
export const isFlyable = (id: AnchorId) => id !== "edge";

/**
 * Radii that frame an arrival and keep the ship off, km: a probe's standoff (a few metres of
 * spacecraft, seen from a little way off with its name on it), a star's photosphere, the
 * Galaxy seen whole from above its disk, a galaxy's disc, the cluster's core, the edge's
 * horizon.
 */
const PROBE_RADIUS_KM = 400;
const FAR_RADIUS_KM: Readonly<Record<Exclude<FarAnchorId, ProbeId>, number>> = {
  alphaCen: alphaCentauriStar("alphaCenA").radiusKm,
  alphaCenB: alphaCentauriStar("alphaCenB").radiusKm,
  proxima: alphaCentauriStar("proxima").radiusKm,
  galacticCentre: (GALAXY.milkyway.diskWidth.value / 2) * LIGHT_YEAR_KM,
  lmc: 7e3 * LIGHT_YEAR_KM,
  smc: 3.5e3 * LIGHT_YEAR_KM,
  andromeda: 1.1e5 * LIGHT_YEAR_KM,
  triangulum: (COSMOS.triangulum.width.value / 2) * LIGHT_YEAR_KM,
  virgoCluster: 2.5e6 * LIGHT_YEAR_KM,
  edge: 1e9 * LIGHT_YEAR_KM,
};

/** The anchor's radius, km. */
export const anchorRadius = (id: AnchorId) =>
  isBodyAnchor(id) ? radiusKm(id) : isProbe(id) ? PROBE_RADIUS_KM : FAR_RADIUS_KM[id];

const v = new Vector3();
const probe: [number, number, number] = [0, 0, 0];

/**
 * The north galactic pole, unit, scene axes (the frame helper places points, so the pole is
 * the difference of two): the edge lies that way, and the Galaxy is seen from it.
 */
export const GALACTIC_NORTH = galaxyToWorld(0, 1, 0, new Vector3())
  .sub(galaxyToWorld(0, 0, 0, new Vector3()))
  .normalize();

/**
 * Where an anchor stands at `date` as the map has it today, km, heliocentric: the bodies,
 * probes and stars where they are then, the far places at their comoving places (`host`, a
 * moon's planet placed already, saves solving it again).
 */
function placeToday(id: AnchorId, date: Date, out: Vec3d, host?: Readonly<Vec3d>): Vec3d {
  if (isBodyAnchor(id)) return bodyPositionKm(id, date, out, host);
  if (id === "alphaCen") return alphaCentauriAt("alphaCenA", date, out);
  if (id === "alphaCenB" || id === "proxima") return alphaCentauriAt(id, date, out);
  if (isProbe(id)) {
    probePosition(id, yearOf(date), probe);
    out[0] = probe[0] * AU_KM;
    out[1] = probe[1] * AU_KM;
    out[2] = probe[2] * AU_KM;
    return out;
  }
  if (id === "galacticCentre") galaxyToWorld(0, 0, 0, v);
  else if (id === "edge")
    v.copy(GALACTIC_NORTH).multiplyScalar((EVENT_HORIZON_LY * LIGHT_YEAR_KM) / AU_KM);
  else cosmicToWorld(anchorToday(anchorById(id)), v);
  out[0] = v.x * AU_KM;
  out[1] = v.y * AU_KM;
  out[2] = v.z * AU_KM;
  return out;
}

/** Moves a place from today's map to the universe at scale `a` (`expansionAt`), in place. */
function expand(out: Vec3d, a: number): Vec3d {
  const k = expansionAt(lengthVec3d(out), a);
  out[0] *= k;
  out[1] *= k;
  out[2] *= k;
  return out;
}

/** Where an anchor is at `date`, with the universe at scale `a`, km, heliocentric. */
export const anchorAt = (id: AnchorId, date: Date, a: number, out: Vec3d): Vec3d =>
  expand(placeToday(id, date, out), a);

/**
 * `anchorAt` for the engine. The universe's scale is the clock's (`scaleNow`), not read from
 * the date: Earth's calendar stops at the JavaScript date's reach while the clock runs on, and
 * the dates a frame asks for lie within a minute of the clock's moment, where a does not move.
 * Each anchor's place today is remembered at the last two instants asked for (a frame asks for
 * the same bodies at its moment, and a minute on for their velocities, many times over), and a
 * moon is placed from its planet's remembered place.
 */
export function createAnchorCache(scaleNow: () => number) {
  type Memo = { t: [number, number]; pos: [Vec3d, Vec3d]; next: 0 | 1 };
  const memos = new Map<AnchorId, Memo>();
  const today = (id: AnchorId, date: Date): Readonly<Vec3d> => {
    const t = date.getTime();
    let memo = memos.get(id);
    if (!memo) memos.set(id, (memo = { t: [NaN, NaN], pos: [vec3d(), vec3d()], next: 0 }));
    if (memo.t[0] === t) return memo.pos[0];
    if (memo.t[1] === t) return memo.pos[1];
    const i = memo.next;
    memo.next = i === 0 ? 1 : 0;
    memo.t[i] = t;
    const body = isBodyAnchor(id) ? worldBody(id) : null;
    return placeToday(
      id,
      date,
      memo.pos[i],
      body?.kind === "moon" ? today(body.host, date) : undefined,
    );
  };
  return (id: AnchorId, date: Date, out: Vec3d): Vec3d => {
    const pos = today(id, date);
    out[0] = pos[0];
    out[1] = pos[1];
    out[2] = pos[2];
    return expand(out, scaleNow());
  };
}

const there: Vec3d = [0, 0, 0];

/** How far an anchor is from `from` (km, heliocentric) at `date`, the universe at scale `a`, km. */
export function distanceTo(id: AnchorId, date: Date, a: number, from: ArrayLike<number>) {
  anchorAt(id, date, a, there);
  return Math.hypot(there[0] - from[0]!, there[1] - from[1]!, there[2] - from[2]!);
}

/** The structures beyond the Galaxy the ship can fly to, by their card. */
const COSMOS_ANCHORS: Partial<Record<string, AnchorId>> = {
  andromeda: "andromeda",
  triangulum: "triangulum",
  virgo: "virgoCluster",
  observableUniverse: "edge",
};

/** The anchor a selection is, if the ship can fly to it. */
export function anchorOfSelection(sel: WorldSelection): AnchorId | null {
  if (isSolarSelection(sel)) return hasSurface(sel) ? (sel.kind === "sun" ? "sun" : sel.id) : null;
  if (sel.kind === "star") return sel.id === "alphaCen" || sel.id === "proxima" ? sel.id : null;
  if (sel.kind === "galaxy") return sel.id === "sun" ? "sun" : "galacticCentre";
  if (sel.kind === "cosmos") return COSMOS_ANCHORS[sel.id] ?? null;
  if (sel.kind === "reach") return sel.id === "heliopause" ? null : sel.id;
  return null;
}

/** The card an anchor opens: its own, the pair's for B; none for the Magellanic Clouds. */
export function selectionOfAnchor(id: AnchorId): WorldSelection | null {
  if (isBodyAnchor(id)) return selectionOfBody(worldBody(id));
  if (isProbe(id)) return { kind: "reach", id };
  if (id === "alphaCen" || id === "alphaCenB") return { kind: "star", id: "alphaCen" };
  if (id === "proxima") return { kind: "star", id };
  if (id === "galacticCentre") return { kind: "galaxy", id: "bulge" };
  if (id === "edge") return { kind: "cosmos", id: "observableUniverse" };
  if (id === "andromeda" || id === "triangulum") return { kind: "cosmos", id };
  if (id === "virgoCluster") return { kind: "cosmos", id: "virgo" };
  return null;
}

/** The message key naming an anchor: the shared names where they exist, Voyage's own for the rest. */
export function anchorNameKey(id: AnchorId) {
  if (id === "galacticCentre" || id === "edge" || id === "lmc" || id === "smc")
    return `anchors.${id}`;
  return `names.${id}`;
}
