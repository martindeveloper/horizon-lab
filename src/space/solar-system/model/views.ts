/** The solar system's framed scales, inner planets to the Oort cloud. Light: routes read it. */
import type { OrbitPose } from "@horizon/toolkit/camera";

export type SolarViewId = "inner" | "giants" | "kuiper" | "scattered" | "oort";
type SolarView = {
  id: SolarViewId;
  /** Camera distance from the Sun, au. */
  dist: number;
  /** Camera pose that frames the view best; the default is `SOLAR_FRAMING`. */
  azimuth?: number;
  inclination?: number;
};

/**
 * How the solar system is framed where a view says nothing else: the orbit camera's angles
 * (radians) and the nearest its frustum comes (au), for every engine that hosts it.
 */
export const SOLAR_FRAMING = { azimuth: 0.6, inclination: 0.52, nearFloor: 0.008 } as const;

/** The pose that frames a view: its own angles where it has them, else the solar framing. */
export function solarViewPose(view: SolarView): OrbitPose {
  return {
    azimuth: view.azimuth ?? SOLAR_FRAMING.azimuth,
    inclination: view.inclination ?? SOLAR_FRAMING.inclination,
    distance: view.dist,
  };
}

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
