import type { PlanetId } from "@horizon/toolkit/bodies";

import type { BlackHoleId, NamedStarId } from "./stellar";

/** A catalogue identity, without loading its measurements or a renderer. */
export type BodyRef =
  | { catalogue: "stars"; id: NamedStarId }
  | { catalogue: "holes"; id: BlackHoleId }
  | { catalogue: "planets"; id: PlanetId };

export const bodyKey = ({ catalogue, id }: BodyRef) => `${catalogue}:${id}`;
