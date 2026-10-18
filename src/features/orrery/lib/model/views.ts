/** Camera views: the framed scales of the solar map and the Galaxy, and the drift by scale. */
export type ViewId = "inner" | "giants" | "kuiper" | "scattered" | "oort" | "stars" | "galaxy";
export type Realm = "solar" | "galaxy";
export type View = {
  id: ViewId;
  realm: Realm;
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
];
export const DEFAULT_VIEW: ViewId = "giants";
export function viewById(id: ViewId) {
  return VIEWS.find((v) => v.id === id) ?? VIEWS[1]!;
}

/** Nearest framed view for a camera distance, measured in log space across scales. */
export function viewForDistance(camDist: number, realm: Realm): ViewId {
  if (realm === "galaxy") return "galaxy";
  const d = Math.max(1e-6, camDist);
  let best: ViewId = DEFAULT_VIEW;
  let bestGap = Infinity;
  for (const v of VIEWS) {
    if (v.realm !== "solar") continue;
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

/** Along-orbit speed-up, in model years per real second, by camera distance. */
export function driftYearsPerSecond(camDist: number, realm: Realm) {
  if (realm === "galaxy") return 0;
  if (camDist < 12) return 0.35;
  if (camDist < 100) return 2.5;
  if (camDist < 400) return 12;
  if (camDist < 6_000) return 80;
  if (camDist < 80_000) return 2_000;
  return 30_000;
}
