/** Deep Field's view ids, near to far, and its default. Light: routes read them. */
import { SOLAR_VIEWS, type SolarViewId } from "@/space/solar-system/model/views";

import { deepFieldManifest } from "../../manifest";

/** Deep Field's own views past the solar system's framings, and the one it adds among them. */
const HELIOSPHERE = "heliosphere";
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

export type ViewId = SolarViewId | typeof HELIOSPHERE | (typeof DEEP_VIEW_IDS)[number];

/** The heliosphere, where the probes are, sits between the Kuiper belt and the scattered disk. */
export const VIEW_IDS: readonly ViewId[] = [
  ...SOLAR_VIEWS.flatMap((v): ViewId[] => (v.id === "kuiper" ? [v.id, HELIOSPHERE] : [v.id])),
  ...DEEP_VIEW_IDS,
];
export const DEFAULT_VIEW: ViewId = deepFieldManifest.solarSystem.defaultView;
