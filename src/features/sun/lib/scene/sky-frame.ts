/**
 * Where the sky stands round the Sun. The lab's world frame has the Sun's pole up and, at the
 * map's epoch, Earth's direction along +x (the central meridian at longitude zero, before the
 * body turns). The stars and the Milky Way are catalogued in the scene frame (ecliptic north
 * up); this is the turn that carries them into the lab's frame, from the Sun's real pole
 * (IAU) and Earth's place in its orbit at the epoch.
 */
import { Matrix4, Quaternion, Vector3 } from "three";

import { MAP_EPOCH } from "@/space/sun/frame";
import {
  bodyOrientation,
  centuriesSinceJ2000,
  jplElements,
  keplerPosition,
} from "@horizon/toolkit/bodies";

/** The scene-frame direction of the Sun's north pole at a date. */
export function solarPole(date: Date, out = new Vector3()) {
  const spin = new Quaternion().fromArray(bodyOrientation("sun", date));
  return out.set(0, 1, 0).applyQuaternion(spin);
}

/** The scene-frame direction from the Sun to Earth at a date. */
export function earthDirection(date: Date, out = new Vector3()) {
  return out.fromArray(keplerPosition(jplElements("earth", centuriesSinceJ2000(date)))).normalize();
}

/**
 * The rotation that takes a scene-frame direction into the lab's world frame at the map's
 * epoch: Earth's direction lands on the equator at +x, the pole on +y.
 */
export function skyOrientation(out = new Quaternion(), epoch = new Date(MAP_EPOCH)) {
  const pole = solarPole(epoch);
  const x = earthDirection(epoch);
  x.addScaledVector(pole, -x.dot(pole)).normalize();
  const z = new Vector3().crossVectors(x, pole);
  /* The basis holds the world axes in scene coordinates; its inverse maps scene to world. */
  return out.setFromRotationMatrix(new Matrix4().makeBasis(x, pole, z)).invert();
}
