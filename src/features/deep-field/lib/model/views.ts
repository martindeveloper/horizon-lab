/** Deep Field's framed views, from the inner planets to the observable universe. */
import { SOLAR_VIEWS } from "@/space/solar-system/model/views";
import { LIGHT_YEAR_AU } from "@horizon/toolkit/science";

import { COSMIC_VIEW_LY } from "./cosmos";
import type { ViewId } from "./view-ids";

/**
 * The map that dominates a scale: the solar system, the nearest stars round it, the Galaxy,
 * and the cosmic map beyond it. Cards, rulers and readouts follow it.
 */
export type Realm = "solar" | "stars" | "galaxy" | "cosmos";
type View = {
  id: ViewId;
  realm: Realm;
  /** Camera distance from its aim, ly. */
  ly: number;
  /** Camera pose that frames the view best; the default is 0.6 / 0.58. */
  azimuth?: number;
  inclination?: number;
};

/** 520 au out, raised so the probes' paths read apart above and below the planets' plane. */
const HELIOSPHERE_VIEW: View = {
  id: "heliosphere",
  realm: "solar",
  ly: 520 / LIGHT_YEAR_AU,
  azimuth: 0.9,
  inclination: 0.42,
};

export const VIEWS: readonly View[] = [
  /* The solar system's own framings, today, and past the Kuiper belt the probes leaving it. */
  ...SOLAR_VIEWS.flatMap(({ id, dist, ...framing }): View[] => {
    const view: View = { id, realm: "solar", ly: dist / LIGHT_YEAR_AU, ...framing };
    return id === "kuiper" ? [view, HELIOSPHERE_VIEW] : [view];
  }),
  /* 560,000 au from the Sun, turned so the four neighbours read apart. */
  { id: "stars", realm: "stars", ly: 560_000 / LIGHT_YEAR_AU, azimuth: 2.14, inclination: 0.47 },
  { id: "galaxy", realm: "galaxy", ly: 92_000 },
  { id: "local-group", realm: "cosmos", ly: COSMIC_VIEW_LY.localGroup, inclination: 0.36 },
  { id: "local-sheet", realm: "cosmos", ly: COSMIC_VIEW_LY.sheet, inclination: 0.28 },
  { id: "virgo-cluster", realm: "cosmos", ly: COSMIC_VIEW_LY.virgo, inclination: 0.42 },
  {
    id: "virgo-supercluster",
    realm: "cosmos",
    ly: COSMIC_VIEW_LY.supercluster,
    inclination: 0.5,
  },
  { id: "laniakea", realm: "cosmos", ly: COSMIC_VIEW_LY.laniakea, inclination: 0.62 },
  /* Turned so Coma and the Sloan Great Wall, nearly in line from us, read apart. */
  { id: "cosmic-web", realm: "cosmos", ly: COSMIC_VIEW_LY.web, azimuth: 1.2, inclination: 0.7 },
  { id: "observable-universe", realm: "cosmos", ly: COSMIC_VIEW_LY.universe, inclination: 0.5 },
];
/** A view by id; an id that is not a view is a bug, not a quiet fallback. */
export function viewById(id: ViewId): View {
  const view = VIEWS.find((v) => v.id === id);
  if (!view) throw new Error(`Unknown view "${id}"`);
  return view;
}

/** A view's camera distance in the scene's unit, au. */
export const worldDistance = (ly: number) => ly * LIGHT_YEAR_AU;

/**
 * How we know how far each view reaches: the method its distances rest on, near to far, from
 * radar inside the solar system to redshift and the expanding-universe model at the edge
 * (copy in `methods.<id>`).
 */
type DistanceMethod =
  | "radar"
  | "tracking"
  | "orbits"
  | "comets"
  | "parallax"
  | "galacticCentre"
  | "candles"
  | "flows"
  | "redshift"
  | "cosmology";

export const METHOD_OF: Readonly<Record<ViewId, DistanceMethod>> = {
  inner: "radar",
  giants: "radar",
  kuiper: "orbits",
  heliosphere: "tracking",
  scattered: "orbits",
  oort: "comets",
  stars: "parallax",
  galaxy: "galacticCentre",
  "local-group": "candles",
  "local-sheet": "candles",
  "virgo-cluster": "candles",
  "virgo-supercluster": "flows",
  laniakea: "flows",
  "cosmic-web": "redshift",
  "observable-universe": "cosmology",
};
