/**
 * The spot groups of the Sun's photograph (`spot-groups-2024-05.json`, written offline by
 * `scripts/locate-sun-spot-groups.mjs` from the same image as the close-up stencil): where each
 * group stands in the mosaic, how far its spots reach and their area, with the NOAA number where
 * a report matches. A visit starts from them: the largest take the region slots at the map's
 * epoch, where the photograph has them, so a name on a group stands on its spots.
 *
 * Frame: as `observed.ts`, the model's longitude is the Carrington longitude less the epoch's
 * central meridian.
 */
import { RAD_PER_DEG } from "@horizon/toolkit/science";

import { modelLongitude, sizeFromArea } from "./observed";
import { REGION_SLOTS } from "./parameters";
import DATA from "./spot-groups-2024-05.json";

/** Seeded regions carry their group's key above every statistical id. */
export const SEEDED_ID_BASE = 20_000_000;
/** Groups no report numbers are keyed above every NOAA number. */
const UNNUMBERED_KEY_BASE = 100_000;

export type SpotGroup = {
  /** Unique among the groups: the NOAA number where a report matches, else one above them all. */
  key: number;
  /** The NOAA number, where a report matches. */
  number: number | null;
  /** Heliographic latitude and model longitude at the epoch, radians. */
  lat: number;
  lon: number;
  /** The group's angular radius from its photographed spot area, radians, as a region's. */
  size: number;
  /** How far its spots reach from its centre, radians. */
  reach: number;
  /** Its spots' area as photographed, millionths of a hemisphere. */
  areaMsh: number;
};

/** Where the groups come from, for cards and the ledger. */
export const SPOT_GROUP_SOURCE = { source: DATA.source, method: DATA.method };

/** The photograph's groups, largest first. */
export const SPOT_GROUPS: readonly SpotGroup[] = DATA.groups.map((group, index) => ({
  key: group.number ?? UNNUMBERED_KEY_BASE + index,
  number: group.number,
  lat: group.lat * RAD_PER_DEG,
  lon: modelLongitude(group.carringtonLon),
  size: sizeFromArea(group.areaMsh),
  reach: group.reachDeg * RAD_PER_DEG,
  areaMsh: group.areaMsh,
}));

/** The groups a visit starts with, one per region slot, largest first. */
export const SEEDED_GROUPS: readonly SpotGroup[] = SPOT_GROUPS.slice(0, REGION_SLOTS);

/** The largest group no slot holds: its spots stay in the photograph alone. */
export const LARGEST_UNSEEDED: SpotGroup | undefined = SPOT_GROUPS[REGION_SLOTS];

/** The seeded group a region is, if any. */
export const seededGroupOf = (id: number): SpotGroup | undefined =>
  id > SEEDED_ID_BASE
    ? SEEDED_GROUPS.find((group) => group.key === id - SEEDED_ID_BASE)
    : undefined;
