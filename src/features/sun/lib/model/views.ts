/**
 * The views, each a URL: where the camera stands, and the light and clock it opens
 * with. The framings themselves are the scene's (`lib/scene/views.ts`).
 */
import type { ClockRate } from "./clock";
import type { LightId } from "./lights";

export const VIEW_IDS = [
  "surface",
  "inside",
  "sunspot",
  "chromosphere",
  "corona",
  "eruption",
  "cycle",
  "orbit",
] as const;

export type ViewId = (typeof VIEW_IDS)[number];

export const DEFAULT_VIEW: ViewId = "surface";

/** What a view opens with: its light and its clock. */
export type ViewDefaults = { light: LightId; clock: ClockRate };

export const VIEW_DEFAULTS: Readonly<Record<ViewId, ViewDefaults>> = {
  surface: { light: "white", clock: "hour" },
  inside: { light: "white", clock: "day" },
  sunspot: { light: "white", clock: "minute" },
  chromosphere: { light: "halpha", clock: "minute" },
  corona: { light: "eclipse", clock: "minute" },
  eruption: { light: "fe171", clock: "minute" },
  cycle: { light: "magnetogram", clock: "year" },
  /* An 88-day orbit at a day a second: a lap in a minute and a half. */
  orbit: { light: "white", clock: "day" },
};

/** The views whose dock carries an action of their own: the cut, the eruption, the cycle. */
export type ViewAction = "cut" | "eruption" | "cycle";

export const VIEW_ACTION: Partial<Record<ViewId, ViewAction>> = {
  inside: "cut",
  eruption: "eruption",
  cycle: "cycle",
};
