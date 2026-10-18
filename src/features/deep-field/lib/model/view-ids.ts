/** Deep Field's view ids, near to far, and its default. Light: routes read them. */
import { SOLAR_VIEWS, type SolarViewId } from "../../../../space/solar-system/model/views";

const DEEP_VIEW_IDS = [
  "stars",
  "galaxy",
  "local-group",
  "local-sheet",
  "virgo-cluster",
  "virgo-supercluster",
  "laniakea",
  "cosmic-web",
  "observable-universe",
] as const;

export type ViewId = SolarViewId | (typeof DEEP_VIEW_IDS)[number];

export const VIEW_IDS: readonly ViewId[] = [...SOLAR_VIEWS.map((v) => v.id), ...DEEP_VIEW_IDS];
export const DEFAULT_VIEW: ViewId = "galaxy";
