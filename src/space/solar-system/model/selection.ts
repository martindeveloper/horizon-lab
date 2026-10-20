/** What can be picked in the solar system scene, and what each has. */
import {
  MOON_IDS,
  moonById,
  type MoonId,
  type NamedId,
  type PlanetId,
} from "@horizon/toolkit/bodies";
import { includesId } from "@horizon/toolkit/records";

import { TRACERS, type Bin } from "./tracers";

export type SolarSelection =
  | { kind: "sun" }
  | { kind: "planet"; id: PlanetId }
  | { kind: "named"; id: NamedId }
  | { kind: "moon"; id: MoonId }
  | { kind: "population"; id: "asteroids" | Bin }
  | { kind: "tracer"; index: number };

/** A tapped object's `userData.pick`, if it is a solar system selection. */
export function isSolarSelection(value: unknown): value is SolarSelection {
  if (typeof value !== "object" || value === null || !("kind" in value)) return false;
  if (value.kind === "sun") return true;
  if (value.kind === "tracer") return "index" in value && typeof value.index === "number";
  if (value.kind === "moon")
    return "id" in value && typeof value.id === "string" && includesId(MOON_IDS, value.id);
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

/** A selection as one string ("sun", "planet:earth", "tracer:12"): equal for the same object. */
export function selectionKey(sel: SolarSelection) {
  switch (sel.kind) {
    case "sun":
      return "sun";
    case "tracer":
      return `tracer:${sel.index}`;
    default:
      return `${sel.kind}:${sel.id}`;
  }
}

/** A selection with a globe to fly in to. */
export type SurfaceSelection = Extract<
  SolarSelection,
  { kind: "sun" | "planet" | "named" | "moon" }
>;

/** Bodies with a globe: the Sun, the planets, the named bodies and the moons. */
export function hasSurface(sel: SolarSelection | null): sel is SurfaceSelection {
  return (
    sel?.kind === "sun" || sel?.kind === "planet" || sel?.kind === "named" || sel?.kind === "moon"
  );
}

/** The planet or named body a moon orbits, as a selection. */
export function hostOf(id: MoonId): Extract<SolarSelection, { kind: "planet" | "named" }> {
  const { host } = moonById(id);
  return host === "pluto" ? { kind: "named", id: "pluto" } : { kind: "planet", id: host };
}
