import { recordBy } from "@horizon/toolkit/records";

/** The body each place the address names parks the ship at. */
import { isBodyAnchor, type AnchorId } from "./anchors";
import { worldBody } from "./bodies";
import { PLACES, VIEW_IDS, type ViewId } from "./view-ids";

export const PLACE_BODY = recordBy(
  PLACES,
  ({ id }) => id,
  ({ anchor }): AnchorId => anchor,
);

const placeOfBody = new Map(VIEW_IDS.map((view) => [PLACE_BODY[view], view]));

/** The place the ship is at when it is at a body: its own, or, for a moon without one, its host's. */
export function placeFor(body: AnchorId): ViewId | null {
  const own = placeOfBody.get(body);
  if (own || !isBodyAnchor(body)) return own ?? null;
  const world = worldBody(body);
  return world.kind === "moon" ? (placeOfBody.get(world.host) ?? null) : null;
}
