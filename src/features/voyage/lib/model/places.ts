/**
 * Each place the address names: the body the ship parks at, and how the arrival frames it.
 * Saturn is framed with its rings; a moon's place looks back at its planet.
 */
import { isBodyAnchor, type AnchorId } from "./anchors";
import { worldBody } from "./bodies";
import type { ViewId } from "./view-ids";

type Place = {
  id: ViewId;
  body: AnchorId;
};

export const PLACES: readonly Place[] = [
  { id: "earth", body: "earth" },
  { id: "moon", body: "moon" },
  { id: "mars", body: "mars" },
  { id: "jupiter", body: "jupiter" },
  { id: "saturn", body: "saturn" },
  { id: "pluto", body: "pluto" },
  { id: "stars", body: "alphaCen" },
  { id: "galaxy", body: "galacticCentre" },
  { id: "andromeda", body: "andromeda" },
  { id: "edge", body: "edge" },
];

/** A place by id; an id that is not a place is a bug, not a quiet fallback. */
export function placeById(id: ViewId): Place {
  const place = PLACES.find((p) => p.id === id);
  if (!place) throw new Error(`Unknown place "${id}"`);
  return place;
}

/** The place at a body, if the address has one. */
const placeOfBody = (body: AnchorId): ViewId | null =>
  PLACES.find((p) => p.body === body)?.id ?? null;

/** The place the ship is at when it is at a body: its own, or, for a moon without one, its host's. */
export function placeFor(body: AnchorId): ViewId | null {
  const own = placeOfBody(body);
  if (own || !isBodyAnchor(body)) return own;
  const world = worldBody(body);
  return world.kind === "moon" ? placeOfBody(world.host) : null;
}
