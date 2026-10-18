/** What can be picked in the solar system scene, and what each has. */
import type { NamedId, PlanetId } from "@horizon/toolkit/bodies";

import { TRACERS, type Bin } from "./tracers";

export type SolarSelection =
  | { kind: "sun" }
  | { kind: "planet"; id: PlanetId }
  | { kind: "named"; id: NamedId }
  | { kind: "population"; id: "asteroids" | Bin }
  | { kind: "tracer"; index: number };

/** A tapped object's `userData.pick`, if it is a solar system selection. */
export function isSolarSelection(value: unknown): value is SolarSelection {
  if (typeof value !== "object" || value === null || !("kind" in value)) return false;
  if (value.kind === "sun") return true;
  if (value.kind === "tracer") return "index" in value && typeof value.index === "number";
  return (
    (value.kind === "planet" || value.kind === "named" || value.kind === "population") &&
    "id" in value &&
    typeof value.id === "string"
  );
}

/**
 * What a tap picked (`userData.pick`, and the instance hit): the samples are one instanced
 * mesh, so the instance names the sample. Null when it is not a solar system selection.
 */
export function solarPick(pick: unknown, instance?: number): SolarSelection | null {
  if (typeof pick === "object" && pick !== null && "kind" in pick && pick.kind === "tracer")
    return instance !== undefined && TRACERS[instance] ? { kind: "tracer", index: instance } : null;
  return isSolarSelection(pick) ? pick : null;
}

/** Bodies with a globe: the Sun, the planets and the named bodies. */
export function hasSurface(sel: SolarSelection | null) {
  return sel?.kind === "sun" || sel?.kind === "planet" || sel?.kind === "named";
}
