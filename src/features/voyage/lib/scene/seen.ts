/**
 * Where a body appears to a moving ship: its direction aberrated toward the direction of
 * travel, and its apparent size divided by the Doppler factor of its light (solid angles
 * shrink ahead by D²). A sphere's outline stays a circle however fast the ship goes
 * (Penrose 1959, Terrell 1959), so moving and resizing the globe is the whole effect; what
 * is not drawn is the shift of its light's colour. At rest a body is simply placed by its
 * offset from the ship.
 */
import type { Object3D } from "three";

import { placeRelative, type Vec3d } from "@horizon/toolkit/scene";
import { aberrate, relativisticDoppler } from "@horizon/toolkit/science";

import type { ShipMotion } from "../model/ship";

const n = { x: 0, y: 0, z: 0 };
const f = { x: 0, y: 0, z: 0 };

/**
 * Places `object` where a body at `pos` (km, heliocentric) is seen from the ship at `ship`
 * moving as `motion`. Returns the Doppler factor of the body's light (1 at rest).
 */
export function placeSeen(
  object: Object3D,
  pos: Readonly<Vec3d>,
  ship: Readonly<Vec3d>,
  motion: ShipMotion,
) {
  if (motion.beta === 0) {
    placeRelative(object, pos, ship);
    return 1;
  }
  const dx = pos[0] - ship[0];
  const dy = pos[1] - ship[1];
  const dz = pos[2] - ship[2];
  const d = Math.hypot(dx, dy, dz);
  if (d === 0) {
    object.position.set(0, 0, 0);
    return 1;
  }
  n.x = dx / d;
  n.y = dy / d;
  n.z = dz / d;
  f.x = motion.forward[0];
  f.y = motion.forward[1];
  f.z = motion.forward[2];
  const cosTheta = n.x * f.x + n.y * f.y + n.z * f.z;
  const D = relativisticDoppler(motion.beta, motion.gamma, cosTheta);
  aberrate(n, f, motion.beta, motion.gamma, n);
  /* Farther along the seen direction by D: the disc is 1/D as wide. */
  const seen = d * D;
  object.position.set(n.x * seen, n.y * seen, n.z * seen);
  return D;
}
