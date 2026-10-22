/**
 * Gravity about the ship: the bodies' gravitational parameters, the pull of a few wells at a
 * point, and the time scales that bound how finely a flight past them must be stepped. Newton
 * serves: near enough to a body for its pull to matter, the ship goes nowhere near light speed.
 */
import { NAMED_STARS } from "@/space/stellar";
import { GM_KM3_S2 as BODY_GM, type BodyId } from "@horizon/toolkit/bodies";
import { SOLAR_GM_SI } from "@horizon/toolkit/science";

import type { AnchorId } from "./anchors";

/** The Sun's GM, km³/s². */
const SUN_GM = SOLAR_GM_SI / 1e9;

/**
 * Gravitational parameters GM, km³/s²: the bodies' from the toolkit, the stars' from the
 * shared catalogue's masses. Small bodies, probes and the far places pull nothing the ship
 * would notice.
 */
const GM_KM3_S2: Partial<Record<AnchorId, number>> = {
  ...BODY_GM,
  alphaCen: NAMED_STARS["alpha-cen-a"].mass.value * SUN_GM,
  alphaCenB: NAMED_STARS["alpha-cen-b"].mass.value * SUN_GM,
  proxima: NAMED_STARS.proxima.mass.value * SUN_GM,
};

/** A body's GM, km³/s²; zero for one that pulls nothing worth stepping. */
export const gmOf = (id: AnchorId | BodyId) => GM_KM3_S2[id as AnchorId] ?? 0;

/** A source of gravity over one step: where it is at the step's start, its velocity, its GM. */
export type Well = { pos: [number, number, number]; vel: [number, number, number]; gm: number };

export const createWell = (): Well => ({ pos: [0, 0, 0], vel: [0, 0, 0], gm: 0 });

/**
 * The pull at `x` (km), km/s², with each well moved `dt` seconds along its velocity: within a
 * frame the bodies move on straight lines, which their curvature over a frame never notices.
 */
export function gravityAt(
  x: ArrayLike<number>,
  wells: readonly Well[],
  dt: number,
  out: [number, number, number],
) {
  out[0] = out[1] = out[2] = 0;
  for (const w of wells) {
    if (w.gm <= 0) continue;
    const dx = w.pos[0] + w.vel[0] * dt - x[0]!;
    const dy = w.pos[1] + w.vel[1] * dt - x[1]!;
    const dz = w.pos[2] + w.vel[2] * dt - x[2]!;
    const r2 = dx * dx + dy * dy + dz * dz;
    if (r2 === 0) continue;
    const k = w.gm / (r2 * Math.sqrt(r2));
    out[0] += k * dx;
    out[1] += k * dy;
    out[2] += k * dz;
  }
  return out;
}

/** The dynamical time at `r` km from a well, seconds: an orbit there takes 2π of them. */
export const dynamicalTime = (r: number, gm: number) =>
  gm > 0 ? Math.sqrt((r * r * r) / gm) : Infinity;

/** The speed of a circular orbit at `r` km from a well, km/s. */
export const circularSpeed = (r: number, gm: number) => (gm > 0 ? Math.sqrt(gm / r) : 0);

/** Pieces a step is cut into at least: this many per dynamical time keep an orbit's energy. */
export const PIECES_PER_DYNAMICAL_TIME = 40;
