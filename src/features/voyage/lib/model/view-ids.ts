/** Voyage's places, near to far, and its default. Light: routes read them. */

export const VIEW_IDS = [
  "earth",
  "moon",
  "mars",
  "jupiter",
  "saturn",
  "pluto",
  "stars",
  "galaxy",
  "andromeda",
  "edge",
] as const;

export type ViewId = (typeof VIEW_IDS)[number];

export const DEFAULT_VIEW: ViewId = "earth";
