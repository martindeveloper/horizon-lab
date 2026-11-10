/**
 * The corona's light and the wind that leaves it: the white-light corona as Baumbach 1937
 * fitted eclipse photometry, read as its two parts, the K-corona (electrons scattering the
 * photosphere's light: the fit's two steep terms) and the F-corona (dust, flat: its r^−2.5
 * term, which takes over beyond ~2 R); the E-corona (the Fe XIV green line of 2 MK gas); and
 * the solar wind's speed by latitude as Ulysses measured it (McComas et al. 2000). Radii in R☉
 * from the centre; brightness in millionths of the disc centre's.
 */
import { smoothstep } from "@horizon/toolkit/math";
import { pressureScaleHeight } from "@horizon/toolkit/science";

import {
  BAUMBACH_TERMS,
  CORONAL_MEAN_MOLECULAR_WEIGHT,
  E_CORONA_KELVIN,
  RADIUS_M,
  STREAMER_CONTRAST,
  SURFACE_GRAVITY,
  WIND_BELT_MAX_RAD,
  WIND_BELT_MIN_RAD,
  WIND_BLEND_RAD,
  WIND_FAST_KM_S,
  WIND_SLOW_KM_S,
} from "./parameters";

/** Baumbach's terms as the model reads them: the dust's flat term, then the electrons' steep two. */
const [F_TERM, ...K_TERMS] = BAUMBACH_TERMS;

/** The K-corona at `r` (R from the centre), millionths of the disc centre's brightness: the fit's steep terms. */
export function kCorona(r: number) {
  let sum = 0;
  for (const { coefficient, power } of K_TERMS) sum += coefficient * r ** -power;
  return sum;
}

/** The F-corona at `r`: the fit's flat term, sunlight on dust. */
export const fCorona = (r: number) => F_TERM.coefficient * r ** -F_TERM.power;

/** The white-light corona at `r`, as Baumbach fitted it: K and F together. */
export const whiteLightCorona = (r: number) => kCorona(r) + fCorona(r);

/**
 * The corona's constants as a shader reads them: Baumbach's three coefficients (powers
 * `BAUMBACH_POWERS`, the dust's term first) and the E-corona's scale height in R
 * (`E_CORONA_SCALE_HEIGHT_R`, below; its glow falls as `eCorona`).
 */
export const BAUMBACH_POWERS: readonly [number, number, number] = [
  BAUMBACH_TERMS[0].power,
  BAUMBACH_TERMS[1].power,
  BAUMBACH_TERMS[2].power,
];

/** The hydrostatic scale height of 2 MK gas in the Sun's surface gravity, in R. */
export const E_CORONA_SCALE_HEIGHT_R =
  pressureScaleHeight.compute({
    T: E_CORONA_KELVIN,
    mu: CORONAL_MEAN_MOLECULAR_WEIGHT,
    g: SURFACE_GRAVITY,
  }) / RADIUS_M;
export const CORONA: {
  k: readonly [number, number, number];
  eScaleHeight: number;
} = {
  k: [BAUMBACH_TERMS[0].coefficient, BAUMBACH_TERMS[1].coefficient, BAUMBACH_TERMS[2].coefficient],
  eScaleHeight: E_CORONA_SCALE_HEIGHT_R,
};

/** The E-corona's emission, relative to its base, for gas at its temperature: the square of a hydrostatic density. */
export const eCorona = (r: number) => Math.exp((-2 * (r - 1)) / E_CORONA_SCALE_HEIGHT_R);

/**
 * The corona's brightness over closed and open field alike, scaled by what stands there: a
 * streamer over closed field is denser than the open corona beside it.
 */
export const coronaBrightness = (r: number, openness: number) =>
  kCorona(r) * (STREAMER_CONTRAST - (STREAMER_CONTRAST - 1) * openness) + fCorona(r);

/** The slow-wind belt's half-width at a cycle phase: narrow at minimum, most of the sphere at maximum. */
export const windBeltHalfWidth = (phase: number) =>
  WIND_BELT_MIN_RAD + (WIND_BELT_MAX_RAD - WIND_BELT_MIN_RAD) * Math.sin(Math.PI * phase) ** 2;

/** The wind's speed at a latitude and cycle phase, km/s: slow over the belt, fast from the holes, blended over a few degrees. */
export function windSpeed(lat: number, phase = 0) {
  const belt = windBeltHalfWidth(phase);
  const fast = smoothstep(belt, belt + WIND_BLEND_RAD, Math.abs(lat));
  return WIND_SLOW_KM_S + (WIND_FAST_KM_S - WIND_SLOW_KM_S) * fast;
}

/** The wind's speed where the field is open (fast) or closed (slow), km/s. */
export const windSpeedFor = (openness: number) =>
  WIND_SLOW_KM_S + (WIND_FAST_KM_S - WIND_SLOW_KM_S) * openness;
