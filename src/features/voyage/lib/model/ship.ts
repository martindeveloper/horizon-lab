/**
 * The ship as a state: where it is (km, heliocentric, scene axes, in doubles), its proper
 * velocity u = γβc (km/s), its own clock τ and Earth's t, seconds since the visit's epoch.
 * Stepping it in proper time keeps the relativity honest: a torch ship's rapidity grows as
 * φ = aτ/c, position moves by u dτ, and Earth's clock by γ dτ.
 */
import { lengthVec3d, vec3d, type Vec3d } from "@horizon/toolkit/scene";
import { gammaOf } from "@horizon/toolkit/science";

import { C_KM_S } from "./parameters";

/** In orbit about a body, riding with it, or flown by hand on the drive. */
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
export const shipGamma = (ship: ShipState) => gammaOf(lengthVec3d(ship.u));

/** The ship's speed, km/s. */
export const shipSpeed = (ship: ShipState) => lengthVec3d(ship.u) / shipGamma(ship);

/**
 * Thrust is integrated in pieces of at most this rapidity, for a turn across the motion; along
 * it each piece is exact, so past `MAX_THRUST_PIECES` the pieces only grow coarser.
 */
const MAX_STEP_RAPIDITY = 0.005;
const MAX_THRUST_PIECES = 64;
/**
 * The most rapidity the ship reaches: γ ≈ 10²¹, far past the torch ship's trip to the edge
 * (about 25); it keeps the proper speed finite however long the lever is held.
 */
const MAX_RAPIDITY = 50;
const MAX_PROPER_KM_S = C_KM_S * Math.sinh(MAX_RAPIDITY);

/**
 * Gravity over a step: the pull at a point `dt` seconds into the step (km/s², written into
 * `out`), and the pieces the step is cut into at least so an orbit keeps its energy.
 */
export type ShipGravity = {
  at: (x: Readonly<Vec3d>, dt: number, out: Vec3d) => Vec3d;
  pieces: number;
};

const pull: Vec3d = [0, 0, 0];

/**
 * Advances the ship by `dtau` seconds of its own time: thrusting at `accel` (km/s², proper,
 * as the crew feels it) along `dir` (unit) if given, else coasting, and falling in `gravity`
 * if given. The thrust's share along the motion adds rapidity, φ += a dτ / c, exactly; the
 * share across it turns the proper velocity, once. Thrust and gravity each kick half a piece
 * either side of the drift (leapfrog), so an orbit keeps its energy. Position moves by u dτ and
 * Earth's clock by γ dτ, both at the piece's middle.
 */
export function stepShip(
  ship: ShipState,
  dtau: number,
  thrust: { accel: number; dir: ArrayLike<number> } | null,
  gravity: ShipGravity | null = null,
) {
  if (dtau <= 0) return;
  const pieces = Math.max(
    thrust
      ? Math.min(MAX_THRUST_PIECES, Math.ceil((thrust.accel * dtau) / C_KM_S / MAX_STEP_RAPIDITY))
      : 1,
    gravity ? Math.ceil(gravity.pieces) : 1,
    1,
  );
  const h = dtau / pieces;
  const { x, u } = ship;
  if (gravity) gravity.at(x, 0, pull);
  for (let i = 0; i < pieces; i += 1) {
    if (gravity) {
      u[0] += pull[0] * h * 0.5;
      u[1] += pull[1] * h * 0.5;
      u[2] += pull[2] * h * 0.5;
    }
    if (thrust) thrustPiece(u, thrust.accel * h * 0.5, thrust.dir);
    x[0] += u[0] * h;
    x[1] += u[1] * h;
    x[2] += u[2] * h;
    ship.t += gammaOf(Math.hypot(u[0], u[1], u[2])) * h;
    ship.tau += h;
    if (thrust) thrustPiece(u, thrust.accel * h * 0.5, thrust.dir);
    if (gravity) {
      gravity.at(x, (i + 1) * h, pull);
      u[0] += pull[0] * h * 0.5;
      u[1] += pull[1] * h * 0.5;
      u[2] += pull[2] * h * 0.5;
    }
  }
}

/** One piece of thrust, `dv` = a dτ km/s along unit `dir`: rapidity along the motion, a kick across it. */
function thrustPiece(u: Vec3d, dv: number, dir: ArrayLike<number>) {
  const dx = dir[0]!;
  const dy = dir[1]!;
  const dz = dir[2]!;
  const speed = Math.hypot(u[0], u[1], u[2]);
  if (speed === 0) {
    const along = C_KM_S * Math.sinh(Math.min(MAX_RAPIDITY, dv / C_KM_S));
    u[0] = dx * along;
    u[1] = dy * along;
    u[2] = dz * along;
    return;
  }
  const ux = u[0] / speed;
  const uy = u[1] / speed;
  const uz = u[2] / speed;
  const along = dx * ux + dy * uy + dz * uz;
  const rapidity = Math.min(MAX_RAPIDITY, Math.asinh(speed / C_KM_S) + (along * dv) / C_KM_S);
  const next = C_KM_S * Math.sinh(rapidity);
  u[0] = ux * next + (dx - along * ux) * dv;
  u[1] = uy * next + (dy - along * uy) * dv;
  u[2] = uz * next + (dz - along * uz) * dv;
  const total = Math.hypot(u[0], u[1], u[2]);
  if (total > MAX_PROPER_KM_S) {
    const k = MAX_PROPER_KM_S / total;
    u[0] *= k;
    u[1] *= k;
    u[2] *= k;
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
  const gamma = gammaOf(speed);
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
