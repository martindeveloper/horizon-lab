/**
 * The guided journey: from the Moon out to the edge, in a few flights. Each step flies the
 * ship to a body, opens its card and holds while its caption is read, then the journey moves
 * on. Copy lives in `tour.steps.<id>`.
 */
import type { AnchorId } from "./anchors";
import type { ViewId } from "./view-ids";

export type TourStep = {
  /** The step's copy key, one per place. */
  id: ViewId;
  /** The anchor the step flies to; its card opens with it. */
  body: AnchorId;
  /** Seconds the caption holds once the ship has landed, before the journey moves on. */
  dwell?: number;
};

/** Seconds a landed step holds by default. */
export const TOUR_DWELL = 10;

export const TOUR: readonly TourStep[] = [
  { id: "moon", body: "moon" },
  { id: "earth", body: "earth" },
  { id: "mars", body: "mars" },
  { id: "jupiter", body: "io" },
  { id: "saturn", body: "saturn" },
  { id: "pluto", body: "pluto" },
  { id: "stars", body: "alphaCen" },
  { id: "galaxy", body: "galacticCentre" },
  { id: "andromeda", body: "andromeda" },
  { id: "edge", body: "edge", dwell: 16 },
];
