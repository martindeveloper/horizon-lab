/** The solar system's framed scales, inner planets to the Oort cloud. Light: routes read it. */

export type SolarViewId = "inner" | "giants" | "kuiper" | "scattered" | "oort";
export type SolarView = {
  id: SolarViewId;
  /** Camera distance from the Sun, au. */
  dist: number;
  /** Camera pose that frames the view best; the default is 0.6 / 0.52. */
  azimuth?: number;
  inclination?: number;
};

export const SOLAR_VIEWS: readonly SolarView[] = [
  { id: "inner", dist: 6 },
  { id: "giants", dist: 72 },
  { id: "kuiper", dist: 150 },
  { id: "scattered", dist: 1_800 },
  { id: "oort", dist: 170_000 },
];

const ids = new Set<string>(SOLAR_VIEWS.map((v) => v.id));
export const isSolarView = (id: string): id is SolarViewId => ids.has(id);

/** A view by id; an id that is not a view is a bug, not a quiet fallback. */
export function solarViewById(id: SolarViewId): SolarView {
  const view = SOLAR_VIEWS.find((v) => v.id === id);
  if (!view) throw new Error(`Unknown view "${id}"`);
  return view;
}
