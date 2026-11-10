/**
 * Every body the ship can fly to, and where each is at a moment in km (heliocentric, scene
 * axes), in doubles: the shared ephemeris in au times the astronomical unit, the Earth–Moon
 * and Pluto–Charon barycentres resolved to the planets' centres, and each moon at its true
 * offset from its planet. The engine places what it draws from these.
 */
import { barycentreOffset, isBarycentreHost } from "@/space/solar-system/model/barycentre";
import { namedElements, planetElements } from "@/space/solar-system/model/elements";
import { moonOffset } from "@/space/solar-system/model/moon-orbits";
import type { SolarSelection } from "@/space/solar-system/model/selection";
import {
  FIGURES,
  MOONS,
  NAMED,
  PLANET_IDS,
  keplerPosition,
  namedById,
  type BodyId,
  type MoonId,
  type NamedId,
  type PlanetId,
  type Vec3,
} from "@horizon/toolkit/bodies";
import type { Vec3d } from "@horizon/toolkit/scene";
import { AU_KM } from "@horizon/toolkit/science";

export type WorldBody =
  | { id: "sun"; kind: "sun" }
  | { id: PlanetId; kind: "planet" }
  | { id: NamedId; kind: "named" }
  | { id: MoonId; kind: "moon"; host: PlanetId | "pluto" };

/** The Sun, the planets, the named small worlds and the moons, in that order. */
export const WORLD_BODIES: readonly WorldBody[] = [
  { id: "sun", kind: "sun" },
  ...PLANET_IDS.map((id): WorldBody => ({ id, kind: "planet" })),
  ...NAMED.map(({ id }): WorldBody => ({ id, kind: "named" })),
  ...MOONS.map(({ id, host }): WorldBody => ({ id, kind: "moon", host })),
];

const byId = new Map(WORLD_BODIES.map((body) => [body.id, body]));
export const worldBody = (id: BodyId) => byId.get(id)!;

/** The card a body opens. */
export function selectionOfBody(body: WorldBody): SolarSelection {
  switch (body.kind) {
    case "sun":
      return { kind: "sun" };
    case "planet":
      return { kind: "planet", id: body.id };
    case "named":
      return { kind: "named", id: body.id };
    case "moon":
      return { kind: "moon", id: body.id };
  }
}

/** A body's mean radius, km. */
export const radiusKm = (id: BodyId) => FIGURES[id].meanKm;

const el: Vec3 = [0, 0, 0];
const off: Vec3 = [0, 0, 0];

/**
 * Where a body's centre is at `date`, km, heliocentric. A planet whose elements place its
 * system's barycentre gets its own centre; a moon sits at its offset from its host's centre
 * (`host`, when the caller has it placed already, saves solving the host again).
 */
export function bodyPositionKm(id: BodyId, date: Date, out: Vec3d, host?: Readonly<Vec3d>): Vec3d {
  const body = worldBody(id);
  switch (body.kind) {
    case "sun":
      out[0] = out[1] = out[2] = 0;
      return out;
    case "planet":
    case "named": {
      const elements =
        body.kind === "planet"
          ? planetElements(body.id, 1, 0, date)
          : namedElements(namedById(body.id), 1, 0, date);
      keplerPosition(elements, el);
      out[0] = el[0] * AU_KM;
      out[1] = el[1] * AU_KM;
      out[2] = el[2] * AU_KM;
      if (isBarycentreHost(body.id)) {
        barycentreOffset(body.id, date, off);
        out[0] += off[0] * AU_KM;
        out[1] += off[1] * AU_KM;
        out[2] += off[2] * AU_KM;
      }
      return out;
    }
    case "moon": {
      if (host) {
        out[0] = host[0];
        out[1] = host[1];
        out[2] = host[2];
      } else bodyPositionKm(body.host, date, out);
      moonOffset(body.id, date, off);
      out[0] += off[0] * AU_KM;
      out[1] += off[1] * AU_KM;
      out[2] += off[2] * AU_KM;
      return out;
    }
  }
}
