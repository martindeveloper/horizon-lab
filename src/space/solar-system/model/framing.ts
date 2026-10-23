/**
 * Which solar system view shows a selection, when a tap should fly there, and how much of a
 * body a camera frames on arrival.
 */
import { MAX_ECCENTRICITY, namedById, type BodyId, type Elements } from "@horizon/toolkit/bodies";

import { namedElements, planetElements } from "./elements";
import { hostOf, solarPick, type SolarSelection } from "./selection";
import { TRACERS, tracerElements } from "./tracers";
import type { SolarViewId } from "./views";

/** The view an orbit is best seen in, by how far it reaches: the belt it lives among. */
function viewOfOrbit(el: Elements): SolarViewId {
  const apo = el.a * (1 + Math.min(MAX_ECCENTRICITY, el.e));
  if (apo > 8_000) {
    return "oort";
  }
  if (apo > 350) {
    return "scattered";
  }
  if (apo > 45) {
    return "kuiper";
  }
  if (apo > 4) {
    return "giants";
  }
  return "inner";
}

/** The view a selection is best seen in: its own scale. */
export function viewOf(sel: SolarSelection, mig = 1): SolarViewId {
  switch (sel.kind) {
    case "sun":
      return "inner";
    case "planet": {
      const a = planetElements(sel.id, 1, 0, new Date()).a;
      /* Uranus fits the giants' frame; Neptune leads out to the Kuiper belt. */
      if (a < 2) {
        return "inner";
      }
      if (a < 25) {
        return "giants";
      }
      return "kuiper";
    }
    case "named":
      return viewOfOrbit(namedElements(namedById(sel.id), 1, 0, new Date()));
    case "moon":
      return viewOf(hostOf(sel.id), mig);
    case "population":
      switch (sel.id) {
        case "asteroids":
          return "inner";
        case "disk":
        case "ejected":
          return "giants";
        default:
          return sel.id;
      }
    case "tracer": {
      const tr = TRACERS[sel.index];
      return tr ? viewOfOrbit(tracerElements(tr, mig, 0)) : "giants";
    }
  }
}

/**
 * The view to fly to when a selection is tapped with the camera `dist` au from the Sun: a
 * planet out of frame, a named body, a sample or the asteroid belt go to their own scale;
 * null keeps the camera where it is.
 */
export function framingView(sel: SolarSelection, mig: number, dist: number): SolarViewId | null {
  /* A moon's tap comes from near its planet: frame it as the planet would be. */
  if (sel.kind === "moon") return framingView(hostOf(sel.id), mig, dist);
  if (sel.kind === "planet") {
    const a = planetElements(sel.id, 1, 0, new Date()).a;
    return dist <= a * 8 && dist >= a * 0.4 ? null : viewOf(sel);
  }
  if (sel.kind === "sun" || (sel.kind === "population" && sel.id !== "asteroids")) return null;
  return viewOf(sel, mig);
}

/**
 * A tap on the solar system (an object's `pick` and instance): selects the body, flying first
 * to the view that frames it when it is out of frame. Returns the selection, or null when the
 * tap was on nothing of the solar system's.
 */
export function selectTapped(
  api: { setView: (view: SolarViewId) => void; select: (sel: SolarSelection) => void },
  target: { pick: unknown; instance?: number | undefined },
  mig: number,
  dist: number,
): SolarSelection | null {
  const sel = solarPick(target.pick, target.instance);
  if (!sel) return null;
  const view = framingView(sel, mig, dist);
  if (view) api.setView(view);
  api.select(sel);
  return sel;
}

/**
 * How much of a body an arriving camera frames, in the body's radii, where the body alone
 * would cut something off: Saturn's bright rings, Halley's glow. Every other body frames its
 * globe. Every host's close-ups and arrivals share it.
 */
export const FRAME_RADII: Partial<Record<BodyId, number>> = { saturn: 2.3, halley: 2.2 };
