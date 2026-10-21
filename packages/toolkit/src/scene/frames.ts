/**
 * three.js adapters for the toolkit's scene frame and spin models (`../bodies`), which return
 * plain arrays: the scene's axes are the ecliptic frame (ecliptic x, ecliptic z up, −ecliptic y).
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
} from "../bodies";
import { GALACTIC_CENTRE_J2000, GALACTIC_POLE_J2000 } from "../science";

const v: Vec3 = [0, 0, 0];
const q: Quat = [0, 0, 0, 1];

/** Equatorial Cartesian coordinates → scene. */
export function equatorialFrameToScene(x: number, y: number, z: number, out = new Vector3()) {
  return out.fromArray(frameToScene(x, y, z, v));
}

/** J2000 RA/Dec in degrees → scene unit vector. */
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

/**
 * The IAU galactic frame (J2000) as scene directions: longitude 0 on the plane (0.06° from
 * Sgr A*), the north galactic pole, and longitude 90° (east).
 */
export const GALACTIC_CENTRE = equatorialToScene(
  GALACTIC_CENTRE_J2000.ra,
  GALACTIC_CENTRE_J2000.dec,
);
export const GALACTIC_POLE = equatorialToScene(GALACTIC_POLE_J2000.ra, GALACTIC_POLE_J2000.dec);
GALACTIC_CENTRE.addScaledVector(GALACTIC_POLE, -GALACTIC_CENTRE.dot(GALACTIC_POLE)).normalize();
export const GALACTIC_EAST = new Vector3().crossVectors(GALACTIC_POLE, GALACTIC_CENTRE).normalize();
