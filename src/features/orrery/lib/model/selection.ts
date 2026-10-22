/**
 * What the Orrery selects and flies to: the solar system's objects and, near Earth, its great
 * observatories. A planet, its moons and (Earth's) observatories are one system: a close-up of
 * one keeps the camera while the card shows another, and Back goes from a moon or an
 * observatory up to its planet.
 */
import {
  isObservatorySelection,
  type ObservatorySelection,
} from "@/space/solar-system/model/observatories";
import {
  hasSurface,
  hostOf,
  selectionKey,
  type SolarSelection,
  type SurfaceSelection,
} from "@/space/solar-system/model/selection";

export type OrrerySelection = SolarSelection | ObservatorySelection;

/** What a close-up flies to: a globe, or an observatory at its true size. */
export type CloseUpSelection = SurfaceSelection | ObservatorySelection;

export const EARTH = { kind: "planet", id: "earth" } as const satisfies SolarSelection;

/** The solar system's own part of a selection, for the layers that draw it. */
export const solarPart = (sel: OrrerySelection | null): SolarSelection | null =>
  sel && !isObservatorySelection(sel) ? sel : null;

/** A selection a close-up can fly to. */
export const canFlyTo = (sel: OrrerySelection | null): sel is CloseUpSelection =>
  hasSurface(solarPart(sel)) || isObservatorySelection(sel);

/** A selection as one string: equal for the same object. */
export const orreryKey = (sel: OrrerySelection) =>
  isObservatorySelection(sel) ? `observatory:${sel.id}` : selectionKey(sel);

/** The planet a moon orbits, or Earth for an observatory; null for the rest. */
export function upFrom(sel: OrrerySelection) {
  if (isObservatorySelection(sel)) return EARTH;
  return sel.kind === "moon" ? hostOf(sel.id) : null;
}

/** Whether two selections are one planet's system. */
export const sameSystem = (a: OrrerySelection, b: OrrerySelection) =>
  orreryKey(upFrom(a) ?? a) === orreryKey(upFrom(b) ?? b);
