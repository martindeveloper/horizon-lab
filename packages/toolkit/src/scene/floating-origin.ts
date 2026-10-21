/**
 * A floating origin: the camera stays at the scene's origin and everything is placed by its
 * offset from the viewer, kept in doubles until it is written to three.js. Float32 world
 * positions are coarser than a planet tens of au out (a metre in a hundred million km is a
 * part in 10¹¹), so a scene that flies from a moon's surface to the edge of the universe
 * keeps every model position as a `Vec3d` and subtracts the viewer's each frame.
 */
import type { Object3D } from "three";

import type { Vec3 } from "../bodies/frames";

/** Three doubles, x y z: a plain tuple, since every JavaScript number is a double. */
export type Vec3d = Vec3;

export const vec3d = (x = 0, y = 0, z = 0): Vec3d => [x, y, z];

/** `out = a + b · scale` (scale 1 by default). */
export function addVec3d(out: Vec3d, a: ArrayLike<number>, b: ArrayLike<number>, scale = 1) {
  out[0] = a[0]! + b[0]! * scale;
  out[1] = a[1]! + b[1]! * scale;
  out[2] = a[2]! + b[2]! * scale;
  return out;
}

/** `out = a − b`. */
export function subVec3d(out: Vec3d, a: ArrayLike<number>, b: ArrayLike<number>) {
  out[0] = a[0]! - b[0]!;
  out[1] = a[1]! - b[1]!;
  out[2] = a[2]! - b[2]!;
  return out;
}

export const lengthVec3d = (v: ArrayLike<number>) => Math.hypot(v[0]!, v[1]!, v[2]!);

export const distanceVec3d = (a: ArrayLike<number>, b: ArrayLike<number>) =>
  Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!);

/**
 * Puts `object` at `at − origin`: where a thing is as seen from the viewer at `origin`, the
 * subtraction done in doubles before the float write.
 */
export function placeRelative(object: Object3D, at: ArrayLike<number>, origin: ArrayLike<number>) {
  object.position.set(at[0]! - origin[0]!, at[1]! - origin[1]!, at[2]! - origin[2]!);
  return object;
}
