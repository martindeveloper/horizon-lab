/**
 * The laws Giants computes with beyond the shared ones (`@horizon/toolkit/science`), in SI or
 * solar units, without React or three.js: the ladder's sizes, the cards' derived figures and
 * the shader's granule size all come from here and from the shared laws, through the formulas
 * in `equations.ts`.
 */
import { TAU } from "@horizon/toolkit/math";
import {
  SOLAR_MASS_KG,
  SOLAR_RADIUS_KM,
  SOLAR_TEFF_K,
  lightTravelTime,
  pressureScaleHeight,
  surfaceGravity,
} from "@horizon/toolkit/science";

import { GRANULE_SCALE_HEIGHTS, MEAN_MOLECULAR_WEIGHT, TEASPOON_M3 } from "../parameters";

const SOLAR_RADIUS_M = SOLAR_RADIUS_KM * 1e3;

/** Stefan–Boltzmann turned round: R/R☉ from L/L☉ and T. */
export const radiusOf = (luminositySuns: number, kelvin: number) =>
  Math.sqrt(luminositySuns) / (kelvin / SOLAR_TEFF_K) ** 2;

/**
 * Convection cells across a star's radius: its radius over a cell of `GRANULE_SCALE_HEIGHTS`
 * pressure scale heights of its photosphere. The Sun has hundreds; a red supergiant a handful.
 */
export function granulesAcross(massSuns: number, radiusSuns: number, kelvin: number) {
  const g = surfaceGravity.compute({ M: massSuns * SOLAR_MASS_KG, R: radiusSuns * SOLAR_RADIUS_M });
  const H = pressureScaleHeight.compute({ T: kelvin, mu: MEAN_MOLECULAR_WEIGHT, g });
  return (radiusSuns * SOLAR_RADIUS_M) / (GRANULE_SCALE_HEIGHTS * H);
}

/** Euclidean equatorial circumference / c: a size comparison, not a photon orbit. */
export const lightLapSeconds = (radiusM: number) => lightTravelTime.compute({ d: TAU * radiusM });

/** Mass / oblate-spheroid volume, kg/m³; a sphere when both radii are equal. */
export const spheroidDensity = (massKg: number, equatorialM: number, polarM: number) =>
  (3 * massKg) / (4 * Math.PI * equatorialM ** 2 * polarM);

/** What a teaspoon of matter at a density weighs, kg. */
export const teaspoonKg = (density: number) => density * TEASPOON_M3;
