/**
 * The laws Giants computes with beyond the shared ones (`@horizon/toolkit/science`), in SI or
 * solar units, without React or three.js: the ladder's sizes, the cards' derived figures and
 * the shader's granule size all come from here and from the shared laws (the cells across a
 * radius from `@/space/sun/model/granulation`), through the formulas in `equations.ts`.
 */
import { TAU } from "@horizon/toolkit/math";
import { lightTravelTime } from "@horizon/toolkit/science";

import { TEASPOON_M3 } from "../parameters";

/** Euclidean equatorial circumference / c: a size comparison, not a photon orbit. */
export const lightLapSeconds = (radiusM: number) => lightTravelTime.compute({ d: TAU * radiusM });

/** Mass / oblate-spheroid volume, kg/m³; a sphere when both radii are equal. */
export const spheroidDensity = (massKg: number, equatorialM: number, polarM: number) =>
  (3 * massKg) / (4 * Math.PI * equatorialM ** 2 * polarM);

/** What a teaspoon of matter at a density weighs, kg. */
export const teaspoonKg = (density: number) => density * TEASPOON_M3;
