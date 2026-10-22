/** The ordered places and their arrival anchors; safe for routes. */
import type { AnchorId } from "./anchors";

export const PLACES = [
  { id: "earth", anchor: "earth" },
  { id: "moon", anchor: "moon" },
  { id: "mars", anchor: "mars" },
  { id: "jupiter", anchor: "jupiter" },
  { id: "saturn", anchor: "saturn" },
  { id: "pluto", anchor: "pluto" },
  { id: "stars", anchor: "alphaCen" },
  { id: "galaxy", anchor: "galacticCentre" },
  { id: "andromeda", anchor: "andromeda" },
  { id: "edge", anchor: "edge" },
] as const satisfies readonly { id: string; anchor: AnchorId }[];
export type ViewId = (typeof PLACES)[number]["id"];
export const VIEW_IDS = PLACES.map(({ id }) => id);
export const DEFAULT_VIEW: ViewId = "earth";
