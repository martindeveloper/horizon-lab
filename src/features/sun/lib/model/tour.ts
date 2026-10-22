/**
 * The guided journey, from the core to the wind: each step flies to a view, sets its light,
 * clock and (where the step is inside or at the eruption) the cut or the eruption's moment,
 * lights a place, and holds while its caption is read. Copy lives in `tour.steps.<id>`.
 */
import type { ClockRate } from "./clock";
import type { LightId } from "./lights";
import type { PlaceId } from "./places";
import type { ViewId } from "./views";

export type TourStep = {
  id: string;
  view: ViewId;
  light?: LightId;
  clock?: ClockRate;
  cut?: number;
  eruption?: number;
  place?: PlaceId;
  /** A formula the caption prints (`SUN_EQUATIONS`). */
  equation?: string;
  /** Seconds the caption holds once the shot lands, before the journey moves on. */
  dwell?: number;
};

/** Seconds a landed step holds by default. */
export const TOUR_DWELL = 12;

export const TOUR: readonly TourStep[] = [
  { id: "core", view: "inside", cut: 1, place: "core", equation: "pp-chain-energy" },
  { id: "walk", view: "inside", cut: 1, place: "radiativeZone", equation: "photon-diffusion-time" },
  {
    id: "dynamo",
    view: "inside",
    cut: 1,
    place: "tachocline",
    clock: "day",
    equation: "differential-rotation",
  },
  { id: "granules", view: "sunspot", place: "granule", clock: "minute", equation: "scale-height" },
  { id: "spot", view: "sunspot", place: "sunspot", clock: "hour" },
  { id: "chromosphere", view: "chromosphere", place: "spicule", light: "halpha" },
  {
    id: "eruption",
    view: "eruption",
    light: "fe171",
    eruption: 0,
    place: "flare",
    equation: "reconnection-energy",
    dwell: 40,
  },
  { id: "corona", view: "corona", light: "eclipse", place: "streamer", equation: "alfven-speed" },
  {
    id: "cycle",
    view: "cycle",
    light: "magnetogram",
    clock: "year",
    equation: "wolf-number",
    dwell: 16,
  },
];
