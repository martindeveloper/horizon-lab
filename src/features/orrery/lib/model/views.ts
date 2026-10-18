/** Camera views: the framed scales of the solar map, the Galaxy and beyond, and the drift by scale. */
import { LIGHT_YEAR_AU } from "@horizon/toolkit/science";

import { COSMIC_VIEW_LY } from "./cosmos";

export type ViewId =
  | "inner"
  | "giants"
  | "kuiper"
  | "scattered"
  | "oort"
  | "stars"
  | "galaxy"
  | "local-group"
  | "local-sheet"
  | "virgo-cluster"
  | "virgo-supercluster"
  | "laniakea"
  | "cosmic-web"
  | "observable-universe";
/** The solar map in au; the Galaxy and the cosmic map beyond it in light-years. */
export type Realm = "solar" | "galaxy" | "cosmos";
export type View = {
  id: ViewId;
  realm: Realm;
  /** Camera distance in the realm's unit: au on the solar map, light-years beyond it. */
  dist: number;
  /** Camera pose that frames the view best; the default is 0.6 / 0.52. */
  azimuth?: number;
  inclination?: number;
};

export const VIEWS: readonly View[] = [
  { id: "inner", realm: "solar", dist: 6 },
  { id: "giants", realm: "solar", dist: 72 },
  { id: "kuiper", realm: "solar", dist: 150 },
  { id: "scattered", realm: "solar", dist: 1_800 },
  { id: "oort", realm: "solar", dist: 170_000 },
  { id: "stars", realm: "solar", dist: 560_000, azimuth: 2.14, inclination: 0.47 },
  { id: "galaxy", realm: "galaxy", dist: 92_000 },
  { id: "local-group", realm: "cosmos", dist: COSMIC_VIEW_LY.localGroup, inclination: 0.36 },
  { id: "local-sheet", realm: "cosmos", dist: COSMIC_VIEW_LY.sheet, inclination: 0.28 },
  { id: "virgo-cluster", realm: "cosmos", dist: COSMIC_VIEW_LY.virgo, inclination: 0.42 },
  {
    id: "virgo-supercluster",
    realm: "cosmos",
    dist: COSMIC_VIEW_LY.supercluster,
    inclination: 0.5,
  },
  { id: "laniakea", realm: "cosmos", dist: COSMIC_VIEW_LY.laniakea, inclination: 0.62 },
  /* Turned so Coma and the Sloan Great Wall, nearly in line from us, read apart. */
  {
    id: "cosmic-web",
    realm: "cosmos",
    dist: COSMIC_VIEW_LY.web,
    azimuth: 1.2,
    inclination: 0.7,
  },
  {
    id: "observable-universe",
    realm: "cosmos",
    dist: COSMIC_VIEW_LY.universe,
    inclination: 0.5,
  },
];
export const DEFAULT_VIEW: ViewId = "giants";
export function viewById(id: ViewId) {
  return VIEWS.find((v) => v.id === id) ?? VIEWS[1]!;
}

/** A realm distance in the scene's one unit, au. */
export function worldDistance(dist: number, realm: Realm) {
  return realm === "solar" ? dist : dist * LIGHT_YEAR_AU;
}

/** Nearest framed view of the realm for a camera distance (in its unit), in log space. */
export function viewForDistance(camDist: number, realm: Realm): ViewId {
  const d = Math.max(1e-6, camDist);
  let best: ViewId =
    realm === "solar" ? DEFAULT_VIEW : realm === "galaxy" ? "galaxy" : "observable-universe";
  let bestGap = Infinity;
  for (const v of VIEWS) {
    if (v.realm !== realm) continue;
    const gap = Math.abs(Math.log(d / v.dist));
    if (gap < bestGap) {
      bestGap = gap;
      best = v.id;
    }
  }
  return best;
}

/** True while the camera is still framed at the preset's scale rather than zoomed elsewhere. */
export function atViewDistance(camDist: number, presetDist: number) {
  return Math.abs(Math.log(Math.max(1e-6, camDist) / presetDist)) < 0.25;
}

/** Along-orbit speed-up steps: up to each camera distance (au), model years per real second. */
const DRIFT_STEPS: readonly (readonly [number, number])[] = [
  [12, 0.35],
  [100, 2.5],
  [400, 12],
  [6_000, 80],
  [80_000, 2_000],
  [Infinity, 30_000],
];
/** Half-width of the blend across each step, in e-folds of distance. */
const DRIFT_BLEND = 0.3;

/**
 * Along-orbit speed-up, in model years per real second, by camera distance. Each step's
 * rate holds across its range and blends geometrically into the next over a short span
 * around the edge, so zooming never jolts the motion.
 */
export function driftYearsPerSecond(camDist: number, realm: Realm) {
  if (realm !== "solar") return 0;
  const x = Math.log(Math.max(1e-9, camDist));
  for (let i = 0; i < DRIFT_STEPS.length - 1; i += 1) {
    const [edge, rate] = DRIFT_STEPS[i]!;
    const gap = x - Math.log(edge);
    if (gap > DRIFT_BLEND) continue;
    if (gap < -DRIFT_BLEND) return rate;
    const t = (gap + DRIFT_BLEND) / (2 * DRIFT_BLEND);
    const next = DRIFT_STEPS[i + 1]![1];
    return Math.exp(Math.log(rate) + (Math.log(next) - Math.log(rate)) * t * t * (3 - 2 * t));
  }
  return DRIFT_STEPS[DRIFT_STEPS.length - 1]![1];
}
