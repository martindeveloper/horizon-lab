/** Geometric units: G = c = 1. Horizon of a Schwarzschild hole is r = 2M = Rs. */

import { clamp } from "@horizon/toolkit/math";
import { geometricMassTime, measure, schwarzschildRadius } from "@horizon/toolkit/science";

import {
  innermostStableOrbit,
  kerrHorizon,
  kerrOrbitalPeriod,
  photonOrbit,
  rainClockRate,
  rainFallSpeed,
} from "./equations";
import { SPIN_LIMIT } from "./parameters";

export { SPIN_LIMIT };

/** Schwarzschild radius in kilometers. */
export function schwarzschildKm(massSolar: number): number {
  return schwarzschildRadius.measure({ M: measure(massSolar, "Msun") }).in("km");
}

/** Geometric mass in seconds: GM/c³. */
export function massSeconds(massSolar: number): number {
  return geometricMassTime.compute({ M: measure(massSolar, "Msun") });
}

/**
 * Outer Kerr horizon r+ / M = 1 + sqrt(1 − a²).
 * In units of Rs = 2M this is (1 + sqrt(1 − a²)) / 2.
 */
export function horizonOverM(a: number): number {
  return kerrHorizon.compute({ a: clamp(a, -SPIN_LIMIT, SPIN_LIMIT) });
}

/** Equatorial photon-orbit radius / M. a = 0 → 3. */
export function photonOverM(a: number): number {
  return photonOrbit.compute({ a: clamp(a, -SPIN_LIMIT, SPIN_LIMIT) });
}

/** Critical impact parameter 3√3 M of a Schwarzschild hole: the shadow's radius on the sky. */
export const B_CRIT = 3 * Math.sqrt(3);

/**
 * Critical impact parameters |λ| of the equatorial prograde and retrograde
 * photon orbits in units of M (Bardeen 1973): λ = −(r³ − 3r² + a²r + a²) / (a (r − 1))
 * at the photon-orbit radius. Both equal 3√3 ≈ 5.20 at zero spin; as a → 1 they
 * tend to 2 and 7, so the shadow's equatorial width shrinks from 10.4 M to 9 M
 * (its polar height stays near 10.4 M).
 */
export function criticalImpactParameters(a: number): { prograde: number; retrograde: number } {
  // Prograde and retrograde refer to the hole's own rotation, so only |a| matters.
  const aa = clamp(Math.abs(a), 0, SPIN_LIMIT);
  if (Math.abs(aa) < 1e-3) return { prograde: B_CRIT, retrograde: B_CRIT };
  const lambda = (r: number) => -(r * r * r - 3 * r * r + aa * aa * r + aa * aa) / (aa * (r - 1));
  const prograde = photonOrbit.compute({ a: aa });
  const retrograde = photonOrbit.compute({ a: -aa });
  return { prograde: Math.abs(lambda(prograde)), retrograde: Math.abs(lambda(retrograde)) };
}

/**
 * Closest camera distance for spin a. The camera is a zero-angular-momentum
 * observer, which exists only outside the horizon; it stays 0.3 M clear of
 * r₊ on the equator, where Boyer–Lindquist r = √(d² − a²) is smallest.
 */
/** Camera distance bounds in M; MIN_DIST sits below every spin's `cameraFloor`. */
export const MIN_DIST = 1.6;
export const MAX_DIST = 480;
/** The camera stays this far (radians) from either pole, where the azimuth would degenerate. */
export const INCLINATION_LIMIT = 1.35;
/**
 * The largest spin a preset or the spin slider sets: Thorne's limit (1974), the spin an
 * accreting hole can reach. Formulas still accept up to `SPIN_LIMIT`.
 */
export const MAX_SPIN = 0.998;

export function cameraFloor(a: number): number {
  const r = horizonOverM(a) + 0.3;
  return Math.sqrt(r * r + a * a);
}

/** Prograde ISCO radius / M. a = 0 → 6; a → 1 → 1. */
export function iscoOverM(a: number): number {
  return innermostStableOrbit.compute({ a: clamp(a, -SPIN_LIMIT, SPIN_LIMIT) });
}

/** Keplerian orbital period at radius r/M, Kerr equatorial (prograde). */
export function orbitalPeriodSeconds(massSolar: number, rOverM: number, a: number): number {
  return kerrOrbitalPeriod.compute({ r: Math.max(rOverM, 1), a }) * massSeconds(massSolar);
}

export function iscoPeriodSeconds(massSolar: number, a: number): number {
  return orbitalPeriodSeconds(massSolar, iscoOverM(a), a);
}

/**
 * Rain observer (drop from rest at infinity). Ē = 1, so
 * dτ/dt = 1 − 2M/r. Slower than a hover at the same r because it is moving.
 */
export function rainRedshift(rOverM: number): number {
  return Math.max(0, rainClockRate.compute({ r: Math.max(rOverM, 2.001) }));
}

/** dr/dT for a rain geodesic, T in units of M. Freezes as r → 2M. */
export function rainDrDt(rOverM: number): number {
  return rainFallSpeed.compute({ r: Math.max(rOverM, 2.001) });
}

export function formatSpin(a: number): string {
  return a < 0 ? `−${(-a).toFixed(3)}` : a.toFixed(3);
}
