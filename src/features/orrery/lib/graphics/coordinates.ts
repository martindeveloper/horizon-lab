/**
 * three.js adapters for the toolkit's scene frame and spin models
 * (`@horizon/toolkit/bodies`), which return plain arrays.
 */
import { Quaternion, Vector3 } from "three";

import {
  bodyOrientation as orientationAt,
  equatorialFrameToScene as frameToScene,
  equatorialToScene as raDecToScene,
  poleVector as poleAt,
  type Quat,
  type SpinningId,
  type Vec3,
} from "@horizon/toolkit/bodies";

const v: Vec3 = [0, 0, 0];
const q: Quat = [0, 0, 0, 1];

/** Equatorial Cartesian coordinates → scene (ecliptic x, ecliptic z up, −ecliptic y). */
export function equatorialFrameToScene(x: number, y: number, z: number, out = new Vector3()) {
  return out.fromArray(frameToScene(x, y, z, v));
}

/** J2000 RA/Dec in degrees → scene unit vector, independent of sky rendering. */
export function equatorialToScene(raDeg: number, decDeg: number, out = new Vector3()) {
  return out.fromArray(raDecToScene(raDeg, decDeg, v));
}

/** Spin pole as a scene-frame unit vector. */
export function poleVector(id: SpinningId, T: number, out = new Vector3()) {
  return out.fromArray(poleAt(id, T, v));
}

/** A body's IAU orientation for a three.js SphereGeometry mesh. */
export function bodyOrientation(id: SpinningId, date: Date, out = new Quaternion()) {
  return out.fromArray(orientationAt(id, date, q));
}
