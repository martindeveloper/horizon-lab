/**
 * The places the finder lists, from the core out to the wind: picking one switches to its view
 * (the camera flies only when the view changes), keeps the light unless it does not draw the
 * place (`lightDraws`), when it takes the place's own, sets its clock and opens its card. Each place's name and card copy live under
 * `places.<id>`; its figures come from the Sun's catalogue (`@/space/sun`).
 */
import type { ClockRate } from "./clock";
import type { LightId } from "./lights";
import type { ViewId } from "./views";

export type Place = {
  id: PlaceId;
  view: ViewId;
  /** The light that shows it, taken when the one in use does not draw it; any light draws it when not given. */
  light?: LightId;
  /** The clock that shows it best; the view's own when not given. */
  clock?: ClockRate;
  /** The cut to open, 0–1, where the place is inside. */
  cut?: number;
  /** The eruption's moment to show, 0–1. */
  eruption?: number;
};

export const PLACE_IDS = [
  "star",
  "core",
  "radiativeZone",
  "tachocline",
  "convectionZone",
  "photosphere",
  "granule",
  "sunspot",
  "facula",
  "chromosphere",
  "spicule",
  "prominence",
  "flare",
  "loops",
  "corona",
  "streamer",
  "ejection",
  "wind",
  "parker",
] as const;

export type PlaceId = (typeof PLACE_IDS)[number];

export const PLACES: Readonly<Record<PlaceId, Place>> = {
  star: { id: "star", view: "surface" },
  core: { id: "core", view: "inside", light: "white", cut: 1 },
  radiativeZone: { id: "radiativeZone", view: "inside", light: "white", cut: 1 },
  tachocline: { id: "tachocline", view: "inside", light: "white", cut: 1, clock: "day" },
  convectionZone: { id: "convectionZone", view: "inside", light: "white", cut: 1 },
  photosphere: { id: "photosphere", view: "surface", light: "white" },
  granule: { id: "granule", view: "sunspot", light: "white", clock: "minute" },
  sunspot: { id: "sunspot", view: "sunspot", light: "white" },
  facula: { id: "facula", view: "surface", light: "white" },
  chromosphere: { id: "chromosphere", view: "chromosphere", light: "halpha" },
  spicule: { id: "spicule", view: "chromosphere", light: "halpha" },
  prominence: { id: "prominence", view: "chromosphere", light: "halpha", clock: "hour" },
  flare: { id: "flare", view: "eruption", light: "fe131", eruption: 0.55 },
  loops: { id: "loops", view: "eruption", light: "fe171", eruption: 0.85 },
  corona: { id: "corona", view: "corona", light: "eclipse" },
  streamer: { id: "streamer", view: "corona", light: "eclipse" },
  ejection: { id: "ejection", view: "corona", light: "eclipse", eruption: 0.7, clock: "hour" },
  wind: { id: "wind", view: "corona", light: "eclipse", clock: "hour" },
  parker: { id: "parker", view: "orbit" },
};

/** The places in order, as the finder lists them. */
export const PLACE_LIST: readonly Place[] = PLACE_IDS.map((id) => PLACES[id]);
