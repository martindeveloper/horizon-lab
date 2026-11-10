/**
 * The Sun at an age: what the track tabulates (light, temperature, mass) and what follows from
 * it by the laws: the radius, the surface gravity, the habitable zone's edges and the colour's
 * peak. Pure functions; the scene and the cards read them alike.
 */
import { habitableZoneAt, habitableZoneEdge } from "@/space/sun/model/young-sun";
import {
  SOLAR_MASS_KG,
  SOLAR_RADIUS_KM,
  logGravityCgs,
  stellarRadius,
  surfaceGravity,
  wienDisplacement,
} from "@horizon/toolkit/science";

import { RSUN_PER_AU } from "./equations";
import { trackAt, type Phase } from "./track";

/**
 * Where today's Sun takes a world's water (Kasting, Whitmire & Reynolds 1993), au: within the
 * first a moist greenhouse wets the stratosphere and the hydrogen escapes, within the second
 * the oceans boil in a runaway greenhouse. The first is the habitable zone's inner edge here,
 * as in Schröder & Smith (2008), so the zone passes Earth as its oceans begin to go
 * (`oceans.ts`): one criterion for the map, the globe and the copy. The shared zone's own inner
 * edge is the same limit in Kopparapu et al.'s (2013) cloud-free model, which has Earth all but
 * on it today.
 */
export const WATER_LOSS_AU = 0.95;
export const RUNAWAY_AU = 0.84;

/** The habitable zone at a luminosity (L☉), au: from the water-loss limit to the shared outer edge. */
const zoneAt = (L: number) => ({
  inner: habitableZoneEdge.compute({ today: WATER_LOSS_AU, L }),
  outer: habitableZoneAt(L).outer,
});

export type SunState = {
  age: number;
  /** L☉. */
  luminosity: number;
  /** K. */
  teff: number;
  /** M☉. */
  mass: number;
  /** R☉. */
  radius: number;
  /** au. */
  radiusAu: number;
  /** log₁₀ g, cgs: what the limb tables are gridded on. */
  logg: number;
  /** The habitable zone's edges, au: the water-loss limit and the maximum greenhouse. */
  zone: { inner: number; outer: number };
  /** Where the Sun's spectrum peaks, nm. */
  peakNm: number;
  phase: Phase;
};

export function sunAt(age: number): SunState {
  const { luminosity, teff, mass, phase } = trackAt(age);
  const radius = stellarRadius.compute({ L: luminosity, T: teff });
  const g = surfaceGravity.compute({ M: mass * SOLAR_MASS_KG, R: radius * SOLAR_RADIUS_KM * 1e3 });
  return {
    age,
    luminosity,
    teff,
    mass,
    radius,
    radiusAu: radius / RSUN_PER_AU,
    logg: logGravityCgs(g),
    zone: zoneAt(luminosity),
    peakNm: wienDisplacement.compute({ T: teff }),
    phase,
  };
}
