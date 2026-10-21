/** Geometric units: G = c = 1. Horizon of a Schwarzschild hole is r = 2M = Rs. */

import { clamp, dot3, type Vec3 } from "@horizon/toolkit/math";
import {
  geometricMassTime,
  measure,
  schwarzschildRadius,
  SHADOW_PER_RS,
} from "@horizon/toolkit/science";

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

/**
 * Critical impact parameter of a Schwarzschild hole, the shadow's radius on the sky: 3√3 M,
 * the toolkit's `SHADOW_PER_RS` in units of M = Rs / 2.
 */
export const B_CRIT = 2 * SHADOW_PER_RS;

/**
 * Boyer–Lindquist r and cosθ of a scene point. The scene draws Boyer–Lindquist coordinates as
 * oblate spheroids, x = √(r² + a²) sinθ cosφ, y = r cosθ, z = √(r² + a²) sinθ sinφ, so r is the
 * root of r⁴ − (|p|² − a²) r² − a²y² = 0.
 */
export function blRadius(p: Readonly<Vec3>, a: number): { r: number; mu: number } {
  const R2 = dot3(p, p) - a * a;
  const r = Math.sqrt(0.5 * (R2 + Math.sqrt(R2 * R2 + 4 * a * a * p[1] * p[1])));
  return { r, mu: r > 0 ? p[1] / r : 0 };
}

/**
 * The impact parameter λ = L/E of the spherical photon orbit at radius r, in units of M
 * (Bardeen 1973; Teo 2003): λ = −(r³ − 3r² + a²r + a²) / (a (r − 1)), for a ≠ 0.
 */
export function photonOrbitImpact(r: number, a: number) {
  return -(r * r * r - 3 * r * r + a * a * r + a * a) / (a * (r - 1));
}

/**
 * Critical impact parameters |λ| of the equatorial prograde and retrograde
 * photon orbits in units of M (`photonOrbitImpact` at the photon-orbit radius).
 * Both equal 3√3 ≈ 5.20 at zero spin; as a → 1 they
 * tend to 2 and 7, so the shadow's equatorial width shrinks from 10.4 M to 9 M
 * (its polar height stays near 10.4 M).
 */
export function criticalImpactParameters(a: number): { prograde: number; retrograde: number } {
  // Prograde and retrograde refer to the hole's own rotation, so only |a| matters.
  const aa = clamp(Math.abs(a), 0, SPIN_LIMIT);
  if (Math.abs(aa) < 1e-3) return { prograde: B_CRIT, retrograde: B_CRIT };
  const prograde = photonOrbit.compute({ a: aa });
  const retrograde = photonOrbit.compute({ a: -aa });
  return {
    prograde: Math.abs(photonOrbitImpact(prograde, aa)),
    retrograde: Math.abs(photonOrbitImpact(retrograde, aa)),
  };
}

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
/** The hovering camera keeps this far (M) outside the horizon. */
const HORIZON_CLEARANCE = 0.3;

/**
 * Closest camera distance for spin a. The camera is a zero-angular-momentum
 * observer, which exists only outside the horizon; it stays `HORIZON_CLEARANCE` clear of
 * r₊ on the equator, where Boyer–Lindquist r = √(d² − a²) is smallest.
 */
export function cameraFloor(a: number): number {
  const r = horizonOverM(a) + HORIZON_CLEARANCE;
  return Math.sqrt(r * r + a * a);
}

/** A riding camera stays below this speed, a fraction of c: inside the photon orbit no circular orbit is timelike. */
export const RIDE_SPEED_LIMIT = 0.95;

/**
 * The disk's circular flow at a scene point, seen by the hovering (zero-angular-momentum)
 * observer there: v = (Ω − ω) ϖ / α with the gas's Ω = 1 / (r^{3/2} + a), frame dragging
 * ω = 2ar / A, lapse α = √(ΣΔ / A) and ϖ = √(A / Σ) sin θ (Bardeen, Press & Teukolsky 1972).
 * In units of c along the scene axes, in the shader's local frame; at most `RIDE_SPEED_LIMIT`.
 * Zero on the spin axis and where no hovering observer exists.
 */
export function diskFlowVelocity(
  position: readonly [number, number, number],
  spin: number,
): [number, number, number] {
  const a = clamp(spin, -SPIN_LIMIT, SPIN_LIMIT);
  const [x, , z] = position;
  const cyl = Math.hypot(x, z);
  const { r, mu } = blRadius(position, a);
  const delta = r * r - 2 * r + a * a;
  if (cyl < 1e-9 || delta <= 0) return [0, 0, 0];
  const cos = clamp(mu, -1, 1);
  const sin2 = 1 - cos * cos;
  const sigma = r * r + a * a * cos * cos;
  const bigA = (r * r + a * a) ** 2 - a * a * delta * sin2;
  const lapse = Math.sqrt((sigma * delta) / bigA);
  const drag = (2 * a * r) / bigA;
  const arm = Math.sqrt((bigA / sigma) * sin2);
  const omega = 1 / (r ** 1.5 + a);
  const v = clamp(((omega - drag) * arm) / lapse, -RIDE_SPEED_LIMIT, RIDE_SPEED_LIMIT);
  /* The gas moves toward +φ, which the scene's azimuth (atan2(x, z)) counts backward. */
  return [(-z / cyl) * v, 0, (x / cyl) * v];
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
