/**
 * The major moons in three.js: planet-centred positions as vectors, orbit lines and
 * synchronous spin. The orbits themselves are model/moon-orbits.ts.
 */
import { Matrix4, Quaternion, Vector3 } from "three";

import { moonById, type MoonId, type Vec3 } from "@horizon/toolkit/bodies";
import { RAD_PER_DEG as RAD } from "@horizon/toolkit/science";

import {
  P_AXIS,
  Q_AXIS,
  moonFrame,
  moonOffset as offsetOf,
  writeMoonOrbit,
} from "../model/moon-orbits";

export { writeMoonOrbit };

const at: Vec3 = [0, 0, 0];

/**
 * The moon's offset from its planet in the scene frame, au. `mean` puts it at
 * its mean anomaly on a circle: the direction a synchronous rotator faces.
 */
export function moonOffset(id: MoonId, date: Date, out = new Vector3(), mean = false) {
  return out.fromArray(offsetOf(id, date, at, mean));
}

const basis = new Matrix4();
const p = new Vector3();
const q = new Vector3();
const pole = new Vector3();
const outward = new Vector3();
const east = new Vector3();
const lean = new Vector3();
const z = new Vector3();

/**
 * Synchronous rotation: local +Y is the spin pole (the orbit normal, or the
 * Moon's Cassini-state axis) and longitude 0 (local −X, as in the toolkit's `bodyOrientation`)
 * faces the planet along the mean orbit, so the true orbit's eccentricity
 * shows as libration. Maps' north is the orbit's angular momentum, which is
 * Triton's IAU south: it orbits backwards.
 */
export function moonOrientation(id: MoonId, date: Date, out = new Quaternion()) {
  moonOffset(id, date, outward, true);
  pole.crossVectors(p.fromArray(P_AXIS), q.fromArray(Q_AXIS));
  const tilt = moonById(id).cassini;
  if (tilt) {
    z.fromArray(moonFrame(id).z);
    lean.copy(pole).addScaledVector(z, -pole.dot(z)).normalize();
    pole
      .copy(z)
      .multiplyScalar(Math.cos(tilt * RAD))
      .addScaledVector(lean, -Math.sin(tilt * RAD));
  }
  outward.addScaledVector(pole, -outward.dot(pole)).normalize();
  east.crossVectors(outward, pole);
  basis.makeBasis(outward, pole, east);
  return out.setFromRotationMatrix(basis);
}
