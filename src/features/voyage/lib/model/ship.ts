/**
 * The ship as a state: where it is (km, heliocentric, scene axes, in doubles), its proper
 * velocity u = γβc (km/s), its own clock τ and Earth's t, seconds since the visit's epoch.
 * Stepping it in proper time keeps the relativity honest: a torch ship's rapidity grows as
 * φ = aτ/c, position moves by u dτ, and Earth's clock by γ dτ.
 */
import { lengthVec3d, vec3d, type Vec3d } from "@horizon/toolkit/scene";

import { C_KM_S } from "./parameters";
import { gammaOfProperSpeed } from "./relativity";

/** Parked about a body, riding with it, or flying free on the drive. */
export type ShipMode = "orbit" | "free";

export type ShipState = {
  /** Heliocentric position, km. */
  x: Vec3d;
  /** Proper velocity, km/s. */
  u: Vec3d;
  /** The ship's clock, seconds since the epoch. */
  tau: number;
  /** Earth's clock (coordinate time), seconds since the epoch. */
  t: number;
};

export const createShip = (): ShipState => ({ x: vec3d(), u: vec3d(), tau: 0, t: 0 });

/** The ship's Lorentz factor. */
export const shipGamma = (ship: ShipState) => gammaOfProperSpeed(lengthVec3d(ship.u));

/** The ship's speed, km/s. */
export const shipSpeed = (ship: ShipState) => lengthVec3d(ship.u) / shipGamma(ship);

/** Largest rapidity change per substep: thrust is integrated in pieces this fine. */
const MAX_STEP_RAPIDITY = 0.005;

/**
 * Advances the ship by `dtau` seconds of its own time: thrusting at `accel` (km/s², proper,
 * as the crew feels it) along `dir` (unit) if given, else coasting. The proper velocity
 * changes by the four-acceleration: the thrust's share along the motion counts γ times (so
 * thrust along the motion is exact rapidity integration, φ = aτ/c), the share across it once.
 * Position moves by u dτ and Earth's clock by γ dτ, with γ taken mid-step.
 */
export function stepShip(
  ship: ShipState,
  dtau: number,
  thrust: { accel: number; dir: ArrayLike<number> } | null,
) {
  if (dtau <= 0) return;
  const pieces = thrust
    ? Math.max(1, Math.ceil((thrust.accel * dtau) / C_KM_S / MAX_STEP_RAPIDITY))
    : 1;
  const h = dtau / pieces;
  const { x, u } = ship;
  for (let i = 0; i < pieces; i += 1) {
    const speedBefore = Math.hypot(u[0], u[1], u[2]);
    const gammaBefore = gammaOfProperSpeed(speedBefore);
    if (thrust) {
      const dx = thrust.dir[0]!;
      const dy = thrust.dir[1]!;
      const dz = thrust.dir[2]!;
      /* The thrust's share along the motion, scaled by γ − 1 on top of the whole. */
      const along = speedBefore > 0 ? (dx * u[0] + dy * u[1] + dz * u[2]) / speedBefore : 0;
      const extra = speedBefore > 0 ? ((gammaBefore - 1) * along) / speedBefore : 0;
      u[0] += thrust.accel * (dx + extra * u[0]) * h;
      u[1] += thrust.accel * (dy + extra * u[1]) * h;
      u[2] += thrust.accel * (dz + extra * u[2]) * h;
    }
    x[0] += u[0] * h;
    x[1] += u[1] * h;
    x[2] += u[2] * h;
    const gammaAfter = gammaOfProperSpeed(Math.hypot(u[0], u[1], u[2]));
    ship.t += 0.5 * (gammaBefore + gammaAfter) * h;
    ship.tau += h;
  }
}

/** The ship's motion as the sky's shaders read it: β, γ and the unit direction of travel. */
export type ShipMotion = { beta: number; gamma: number; forward: Vec3d };

export const createShipMotion = (): ShipMotion => ({ beta: 0, gamma: 1, forward: [0, 0, -1] });

/** Below this share of light speed the sky is the sky: no aberration worth drawing. */
const SKY_AT_REST_BETA = 1e-3;

/** Writes the ship's β, γ and heading into `out`; a slow ship leaves the sky at rest. */
export function shipMotion(ship: ShipState, out: ShipMotion): ShipMotion {
  const speed = lengthVec3d(ship.u);
  const gamma = gammaOfProperSpeed(speed);
  const beta = speed / (gamma * C_KM_S);
  if (beta < SKY_AT_REST_BETA) {
    out.beta = 0;
    out.gamma = 1;
    return out;
  }
  out.beta = beta;
  out.gamma = gamma;
  out.forward[0] = ship.u[0] / speed;
  out.forward[1] = ship.u[1] / speed;
  out.forward[2] = ship.u[2] / speed;
  return out;
}

/** Stops the ship (relative to the Sun's frame). */
export function haltShip(ship: ShipState) {
  ship.u[0] = ship.u[1] = ship.u[2] = 0;
}
