/**
 * How the Sun turns: at the surface by latitude (Snodgrass & Ulrich 1990, from Doppler
 * features), rigidly below the tachocline at the surface law's mean rate (helioseismology's
 * ~430 nHz core), and between them the shear of the tachocline (Charbonneau et al. 1999).
 */
import { smoothstep } from "@horizon/toolkit/math";
import { RAD_PER_DEG } from "@horizon/toolkit/science";

import { DAY_S, TACHOCLINE_R, TACHOCLINE_THICKNESS_R } from "./parameters";

/** Ω(φ) = A + B sin²φ + C sin⁴φ, degrees per day, sidereal (Snodgrass & Ulrich 1990, Table 1, Doppler). */
export const SURFACE_ROTATION_DEG_PER_DAY = { A: 14.713, B: -2.396, C: -1.787 } as const;

/** The surface law in its own units: degrees per day at latitude `lat` (radians). */
export function surfaceRateDegPerDay(lat: number) {
  const s2 = Math.sin(lat) ** 2;
  const { A, B, C } = SURFACE_ROTATION_DEG_PER_DAY;
  return A + B * s2 + C * s2 * s2;
}

/** The surface's angular speed at a latitude, rad/s. */
export const surfaceRate = (lat: number) => (surfaceRateDegPerDay(lat) * RAD_PER_DEG) / DAY_S;

/**
 * The Carrington frame: the sidereal rate Carrington fixed in 1863 for the spots' mean
 * rotation, 14.1844°/day (a 25.38-day turn), the frame synoptic maps and butterfly diagrams
 * are drawn in. (Seen from Earth the turn is synodic: `observed.ts` keeps that rate.)
 */
export const CARRINGTON_SIDEREAL_DEG_PER_DAY = 14.1844;
export const CARRINGTON_SIDEREAL_RATE = (CARRINGTON_SIDEREAL_DEG_PER_DAY * RAD_PER_DEG) / DAY_S;

/**
 * The rigid interior's rate: the surface law averaged over the sphere (∫ Ω cos φ dφ / 2 =
 * A + B/3 + C/5), 13.56°/day, a 26.5-day turn; helioseismology puts the radiative interior near
 * 430 nHz, a 26.9-day turn.
 */
const { A, B, C } = SURFACE_ROTATION_DEG_PER_DAY;
export const INTERIOR_RATE_DEG_PER_DAY = A + B / 3 + C / 5;
export const INTERIOR_RATE = (INTERIOR_RATE_DEG_PER_DAY * RAD_PER_DEG) / DAY_S;

/** Sidereal rotation period at a latitude, seconds. */
export const surfacePeriod = (lat: number) => (2 * Math.PI) / surfaceRate(lat);

/**
 * The angular speed at radius `x` (R) and latitude, rad/s: rigid below the tachocline, the
 * surface's law through the convection zone (whose rotation is nearly constant on radial lines),
 * blended across the tachocline's thickness.
 */
export function rateAt(x: number, lat: number) {
  const shear = smoothstep(TACHOCLINE_R - TACHOCLINE_THICKNESS_R, TACHOCLINE_R, x);
  return INTERIOR_RATE + (surfaceRate(lat) - INTERIOR_RATE) * shear;
}

/** How far a parcel at `x`, `lat` has turned after `seconds`, radians. */
export const turnAt = (x: number, lat: number, seconds: number) => rateAt(x, lat) * seconds;

/** How far a surface feature at `lat` lags the equator after `seconds`, radians (negative: it falls behind). */
export const lagBehindEquator = (lat: number, seconds: number) =>
  (surfaceRate(lat) - surfaceRate(0)) * seconds;
