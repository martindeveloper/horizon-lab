/**
 * Three-component vectors as plain tuples, for model code that runs without three.js (orbits,
 * frames, poses, the CPU side of a shader). Each operation writes `out` when one is given, so a
 * hot loop can reuse a scratch tuple; `out` may alias an input.
 */

export type Vec3 = [x: number, y: number, z: number];

export const dot3 = (a: Readonly<Vec3>, b: Readonly<Vec3>) =>
  a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export const length3 = (v: Readonly<Vec3>) => Math.hypot(v[0], v[1], v[2]);

export function add3(a: Readonly<Vec3>, b: Readonly<Vec3>, out: Vec3 = [0, 0, 0]): Vec3 {
  out[0] = a[0] + b[0];
  out[1] = a[1] + b[1];
  out[2] = a[2] + b[2];
  return out;
}

export function scale3(v: Readonly<Vec3>, s: number, out: Vec3 = [0, 0, 0]): Vec3 {
  out[0] = v[0] * s;
  out[1] = v[1] * s;
  out[2] = v[2] * s;
  return out;
}

export function cross3(a: Readonly<Vec3>, b: Readonly<Vec3>, out: Vec3 = [0, 0, 0]): Vec3 {
  const x = a[1] * b[2] - a[2] * b[1];
  const y = a[2] * b[0] - a[0] * b[2];
  const z = a[0] * b[1] - a[1] * b[0];
  out[0] = x;
  out[1] = y;
  out[2] = z;
  return out;
}

/** The unit vector along `v`; a zero vector stays zero. */
export function normalize3(v: Readonly<Vec3>, out: Vec3 = [0, 0, 0]): Vec3 {
  // Scale before taking the norm: finite components can have an overflowing norm or reciprocal.
  const scale = Math.max(Math.abs(v[0]), Math.abs(v[1]), Math.abs(v[2])) || 1;
  const x = v[0] / scale;
  const y = v[1] / scale;
  const z = v[2] / scale;
  const length = Math.hypot(x, y, z) || 1;
  out[0] = x / length;
  out[1] = y / length;
  out[2] = z / length;
  return out;
}
