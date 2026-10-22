/**
 * The places the finder lists, from the core out to the wind: picking one switches to its view
 * (the camera flies only when the view changes), sets its light and clock and opens its card. Each place's name and card copy live under
 * `places.<id>`; its figures come from the Sun's catalogue (`@/space/sun`).
 */
import type { ClockRate } from "./clock";
import type { LightId } from "./lights";
import type { ViewId } from "./views";

export type Place = {
  id: PlaceId;
  view: ViewId;
  /** The light and clock that show it best; the view's own when not given. */
  light?: LightId;
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
  core: { id: "core", view: "inside", cut: 1 },
  radiativeZone: { id: "radiativeZone", view: "inside", cut: 1 },
  tachocline: { id: "tachocline", view: "inside", cut: 1, clock: "day" },
  convectionZone: { id: "convectionZone", view: "inside", cut: 1 },
  photosphere: { id: "photosphere", view: "surface" },
  granule: { id: "granule", view: "sunspot", clock: "minute" },
  sunspot: { id: "sunspot", view: "sunspot" },
  facula: { id: "facula", view: "surface" },
  chromosphere: { id: "chromosphere", view: "chromosphere" },
  spicule: { id: "spicule", view: "chromosphere" },
  prominence: { id: "prominence", view: "chromosphere", clock: "hour" },
  flare: { id: "flare", view: "eruption", eruption: 0.55 },
  loops: { id: "loops", view: "eruption", eruption: 0.85 },
  corona: { id: "corona", view: "corona" },
  streamer: { id: "streamer", view: "corona" },
  ejection: { id: "ejection", view: "corona", eruption: 0.7, clock: "hour" },
  wind: { id: "wind", view: "corona", clock: "hour" },
  parker: { id: "parker", view: "orbit" },
};

/** The places in order, as the finder lists them. */
export const PLACE_LIST: readonly Place[] = PLACE_IDS.map((id) => PLACES[id]);
