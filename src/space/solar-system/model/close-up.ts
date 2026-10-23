import type { Vector3 } from "three";

/**
 * What a close-up of the solar system flies to, in any lab that draws it: a globe (the Sun, a
 * planet, a named small world, a moon), or one of Earth's observatories at its true size. A
 * planet, its moons and (Earth's) observatories are one system: a close-up of one keeps the
 * camera while the card shows another, and Back goes from a moon or an observatory up to its
 * planet. The host's rig follows the close-up in progress (`CloseUpFrame`): around the body
 * once arrived, open while a flight carries the camera.
 */
import { closeUpLimits } from "@/space/close-up-flight";
import type { ZoomLimits } from "@horizon/toolkit/scene";

import { isObservatorySelection, type ObservatorySelection } from "./observatories";
import {
  hasSurface,
  hostOf,
  isSolarSelection,
  selectionKey,
  type SolarSelection,
  type SurfaceSelection,
} from "./selection";

/** What a close-up flies to: a globe, or an observatory at its true size. */
export type CloseUpSelection = SurfaceSelection | ObservatorySelection;

export const EARTH = { kind: "planet", id: "earth" } as const satisfies SolarSelection;

/** A selection a close-up can fly to. */
export const canFlyTo = (sel: { kind: string } | null): sel is CloseUpSelection =>
  (isSolarSelection(sel) && hasSurface(sel)) || isObservatorySelection(sel);

/** A selection as one string: equal for the same object. */
export const closeUpKey = (sel: SolarSelection | ObservatorySelection) =>
  isObservatorySelection(sel) ? `observatory:${sel.id}` : selectionKey(sel);

/** The planet a moon orbits, or Earth for an observatory; null for the rest. */
export function upFrom(sel: SolarSelection | ObservatorySelection) {
  if (isObservatorySelection(sel)) return EARTH;
  return sel.kind === "moon" ? hostOf(sel.id) : null;
}

/** Whether two selections are one planet's system. */
export const sameSystem = (
  a: SolarSelection | ObservatorySelection,
  b: SolarSelection | ObservatorySelection,
) => closeUpKey(upFrom(a) ?? a) === closeUpKey(upFrom(b) ?? b);

/** What a rig needs to know about a close-up in progress. */
export type CloseUpFrame = { phase: "in" | "on" | "out"; radius: number; frame: number };

/**
 * The zoom's bounds while a close-up is in progress: around the body once arrived, open (out
 * to `open.max`) while a flight carries the camera; the host's own bounds without one.
 */
export function closeUpZoom(close: CloseUpFrame | null, open: ZoomLimits): ZoomLimits {
  if (!close) return open;
  return close.phase === "on"
    ? closeUpLimits(close.radius, close.frame)
    : { min: 1e-12, max: open.max };
}

/**
 * The main pass's far plane in a close-up: it draws the rest of the system while the body gets
 * a depth pass of its own, so it reaches past the aim's distance from the Sun.
 */
export const closeUpFar = (distance: number, aim: Vector3) =>
  Math.max(distance * 40, aim.length() * 2 + 60);
