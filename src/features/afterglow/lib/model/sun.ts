/**
 * The Sun at an age: what the track tabulates (light, temperature, mass) and what follows from
 * it by the laws: the radius, the surface gravity, the habitable zone's edges and the colour's
 * peak. Pure functions; the scene and the cards read them alike.
 */
import { habitableZoneAt } from "@/space/sun/model/young-sun";
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
  /** The habitable zone's edges, au. */
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
    zone: habitableZoneAt(luminosity),
    peakNm: wienDisplacement.compute({ T: teff }),
    phase,
  };
}
