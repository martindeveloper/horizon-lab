/**
 * The guided journey: from the Moon out through the solar system, in a few flights. Each step
 * flies the ship to a body, lights what it is about and holds while its caption is read, then
 * the journey moves on. Copy lives in `tour.steps.<id>`.
 */
import type { WorldSelection } from "@/space/galaxy/show";

import type { AnchorId } from "./anchors";
import type { ViewId } from "./view-ids";

export type TourStep = {
  /** The step's copy key, one per place. */
  id: ViewId;
  /** The anchor the step flies to. */
  body: AnchorId;
  focus?: WorldSelection;
  /** Seconds the caption holds once the ship has landed, before the journey moves on. */
  dwell?: number;
};

/** Seconds a landed step holds by default. */
export const TOUR_DWELL = 10;

export const TOUR: readonly TourStep[] = [
  { id: "moon", body: "moon", focus: { kind: "moon", id: "moon" } },
  { id: "earth", body: "earth", focus: { kind: "planet", id: "earth" } },
  { id: "mars", body: "mars", focus: { kind: "planet", id: "mars" } },
  { id: "jupiter", body: "io", focus: { kind: "moon", id: "io" } },
  { id: "saturn", body: "saturn", focus: { kind: "planet", id: "saturn" } },
  { id: "pluto", body: "pluto", focus: { kind: "named", id: "pluto" } },
  { id: "stars", body: "alphaCen", focus: { kind: "star", id: "alphaCen" } },
  { id: "galaxy", body: "galacticCentre", focus: { kind: "galaxy", id: "bulge" } },
  { id: "andromeda", body: "andromeda", focus: { kind: "cosmos", id: "andromeda" } },
  { id: "edge", body: "edge", focus: { kind: "cosmos", id: "observableUniverse" }, dwell: 16 },
];
