/** Where a selection is at a moment, as the scene draws it (au, scene axes). */
import { keplerPosition, namedById, type Elements, type Vec3 } from "@horizon/toolkit/bodies";

import { namedElements, planetElements } from "./elements";
import type { SolarMoment } from "./moment";
import { moonOffset } from "./moon-orbits";
import { hostOf, type SolarSelection } from "./selection";
import { TRACERS, tracerElements, tracerVisible } from "./tracers";

const offset: Vec3 = [0, 0, 0];
const elements: Elements = { a: 0, e: 0, i: 0, omega: 0, node: 0, M: 0 };

/**
 * The Sun at the origin, a body on its orbit at `now` plus the Motion offset, a moon at its
 * true offset from that body, a sample while it exists; null for a population, which is
 * everywhere along its belt or cloud. (A selected planet's system is drawn magnified; the
 * scene reports where it draws a moon.)
 */
export function positionOf(
  sel: SolarSelection,
  { mig, driftYears }: Pick<SolarMoment, "mig" | "driftYears">,
  now: Date,
  out: Vec3 = [0, 0, 0],
): Vec3 | null {
  switch (sel.kind) {
    case "sun":
      out[0] = out[1] = out[2] = 0;
      return out;
    case "planet":
      return keplerPosition(planetElements(sel.id, mig, driftYears, now, elements), out);
    case "named":
      return keplerPosition(namedElements(namedById(sel.id), mig, driftYears, now, elements), out);
    case "moon": {
      const at = positionOf(hostOf(sel.id), { mig, driftYears }, now, out);
      if (!at) return null;
      moonOffset(sel.id, now, offset);
      at[0] += offset[0];
      at[1] += offset[1];
      at[2] += offset[2];
      return at;
    }
    case "tracer": {
      const tr = TRACERS[sel.index];
      return tr && tracerVisible(tr, mig)
        ? keplerPosition(tracerElements(tr, mig, driftYears), out)
        : null;
    }
    case "population":
      return null;
  }
}

const earth: Vec3 = [0, 0, 0];
const body: Vec3 = [0, 0, 0];

/**
 * How far a selection is from Earth at a moment (au): the gap its light crosses to reach us.
 * Null for Earth itself and for a population, which has no one place.
 */
export function distanceFromEarth(
  sel: SolarSelection,
  moment: Pick<SolarMoment, "mig" | "driftYears">,
  now: Date,
): number | null {
  if (sel.kind === "planet" && sel.id === "earth") return null;
  const at = positionOf(sel, moment, now, body);
  if (!at) return null;
  positionOf({ kind: "planet", id: "earth" }, moment, now, earth);
  return Math.hypot(at[0] - earth[0], at[1] - earth[1], at[2] - earth[2]);
}
