import { recordBy, partialFrom } from "@horizon/toolkit/records";

/** Ordered view definitions: route, opening state and action, without a scene import. */
import type { RouteEntry } from "../../../../lib/simulation-paths";
import type { ClockRate } from "./clock";
import type { LightId } from "./lights";

export type ViewDefaults = { light: LightId; clock: ClockRate };
export type ViewAction = "cut" | "eruption" | "cycle";
type Definition = RouteEntry & { defaults: ViewDefaults; action?: ViewAction };
const ENTRIES = [
  {
    id: "surface",
    defaults: { light: "white", clock: "hour" },
    body: { catalogue: "stars", id: "sun" },
    closeUp: true,
  },
  { id: "inside", defaults: { light: "white", clock: "day" }, action: "cut" },
  { id: "sunspot", defaults: { light: "white", clock: "minute" } },
  { id: "chromosphere", defaults: { light: "halpha", clock: "minute" } },
  { id: "corona", defaults: { light: "eclipse", clock: "minute" } },
  { id: "eruption", defaults: { light: "fe171", clock: "minute" }, action: "eruption" },
  { id: "cycle", defaults: { light: "magnetogram", clock: "month" }, action: "cycle" },
  /* An 88-day orbit at a day a second: a lap in a minute and a half. */
  { id: "orbit", defaults: { light: "white", clock: "day" } },
] as const satisfies readonly Definition[];
export type ViewId = (typeof ENTRIES)[number]["id"];
export const VIEW_DEFINITIONS: readonly (Definition & { id: ViewId })[] = ENTRIES;
export const VIEW_IDS = ENTRIES.map(({ id }) => id);
export const DEFAULT_VIEW: ViewId = "surface";

export const VIEW_DEFAULTS = recordBy(
  VIEW_DEFINITIONS,
  ({ id }) => id,
  ({ defaults }) => defaults,
);
export const VIEW_ACTION = partialFrom(
  VIEW_DEFINITIONS.flatMap(({ id, action }) => (action ? [[id, action] as const] : [])),
);

/** Both direct URLs and picker navigation enter the same state. */
export const initialViewState = (view: ViewId) => ({
  ...VIEW_DEFAULTS[view],
  cut: VIEW_ACTION[view] === "cut" ? 1 : 0,
  eruptionPlaying: VIEW_ACTION[view] === "eruption",
});
