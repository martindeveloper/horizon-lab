/**
 * The bodies' gravitational parameters GM, km³ s⁻²: what a lab needs to make them pull.
 * The Sun, Earth and Jupiter are the IAU 2015 Resolution B3 nominal values; the rest come
 * from the JPL planetary (DE440) and satellite ephemerides. A planet's is its own, without its
 * moons. Pluto's and Charon's are the post-New-Horizons fit's (Brozović & Jacobson 2024, AJ
 * 167, 256), Ceres's is Dawn's (Park et al. 2016), Eris's the Eris–Dysnomia system's (Holler
 * et al. 2021), Haumea's its moons' (Ragozzine & Brown 2009). Makemake's, Sedna's and
 * Halley's are unmeasured and pull nothing a lab would notice.
 */
import { EARTH_GM_SI, JUPITER_GM_SI, SOLAR_GM_SI } from "../science";
import type { BodyId } from "./figures";

/** The bodies with a measured GM. */
export type MassiveId = Exclude<BodyId, "makemake" | "sedna" | "halley">;

export const GM_KM3_S2: Readonly<Record<MassiveId, number>> = {
  sun: SOLAR_GM_SI / 1e9,
  mercury: 22_031.87,
  venus: 324_858.59,
  earth: EARTH_GM_SI / 1e9,
  moon: 4_902.8,
  mars: 42_828.37,
  phobos: 7.1e-4,
  deimos: 9.6e-5,
  ceres: 62.6284,
  jupiter: JUPITER_GM_SI / 1e9,
  io: 5_959.92,
  europa: 3_202.71,
  ganymede: 9_887.83,
  callisto: 7_179.29,
  saturn: 37_931_206.2,
  mimas: 2.5,
  enceladus: 7.21,
  tethys: 41.21,
  dione: 73.12,
  rhea: 153.94,
  titan: 8_978.14,
  iapetus: 120.51,
  uranus: 5_793_951.3,
  miranda: 4.32,
  ariel: 83.46,
  umbriel: 85.09,
  titania: 226.94,
  oberon: 205.32,
  neptune: 6_835_099.5,
  triton: 1_428.5,
  pluto: 869.3,
  charon: 106.1,
  haumea: 267.4,
  eris: 1_099,
};
