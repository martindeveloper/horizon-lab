/**
 * The scene frame every body position and axis is given in: X toward the
 * vernal equinox, Y = ecliptic north (up), Z = −y of the right-handed J2000
 * ecliptic frame, so planets run counter-clockwise seen from ecliptic north.
 */

/** A scene-frame vector or point: x, y (ecliptic north), z. */
export type Vec3 = [x: number, y: number, z: number];
/** A rotation as quaternion components, three.js order. */
export type Quat = [x: number, y: number, z: number, w: number];

const RAD = Math.PI / 180;
/** Mean obliquity of the ecliptic at J2000, degrees. */
export const J2000_OBLIQUITY_DEG = 23.4392911;
const COS_OBLIQUITY = Math.cos(J2000_OBLIQUITY_DEG * RAD);
const SIN_OBLIQUITY = Math.sin(J2000_OBLIQUITY_DEG * RAD);

/** ICRF equatorial Cartesian coordinates → scene frame. */
export function equatorialFrameToScene(
  x: number,
  y: number,
  z: number,
  out: Vec3 = [0, 0, 0],
): Vec3 {
  out[0] = x;
  out[1] = -SIN_OBLIQUITY * y + COS_OBLIQUITY * z;
  out[2] = -(COS_OBLIQUITY * y + SIN_OBLIQUITY * z);
  return out;
}

/** J2000 right ascension and declination, degrees → scene-frame unit vector. */
export function equatorialToScene(raDeg: number, decDeg: number, out: Vec3 = [0, 0, 0]): Vec3 {
  const ra = raDeg * RAD;
  const dec = decDeg * RAD;
  return equatorialFrameToScene(
    Math.cos(dec) * Math.cos(ra),
    Math.cos(dec) * Math.sin(ra),
    Math.sin(dec),
    out,
  );
}

/**
 * The rotation taking local axes onto the orthonormal basis x, y, z (the
 * matrix with those columns), as three.js `Quaternion.setFromRotationMatrix`.
 */
export function quaternionFromBasis(x: Vec3, y: Vec3, z: Vec3, out: Quat = [0, 0, 0, 0]): Quat {
  const [m11, m21, m31] = x;
  const [m12, m22, m32] = y;
  const [m13, m23, m33] = z;
  const trace = m11 + m22 + m33;
  if (trace > 0) {
    const s = 0.5 / Math.sqrt(trace + 1);
    out[3] = 0.25 / s;
    out[0] = (m32 - m23) * s;
    out[1] = (m13 - m31) * s;
    out[2] = (m21 - m12) * s;
  } else if (m11 > m22 && m11 > m33) {
    const s = 2 * Math.sqrt(1 + m11 - m22 - m33);
    out[3] = (m32 - m23) / s;
    out[0] = 0.25 * s;
    out[1] = (m12 + m21) / s;
    out[2] = (m13 + m31) / s;
  } else if (m22 > m33) {
    const s = 2 * Math.sqrt(1 + m22 - m11 - m33);
    out[3] = (m13 - m31) / s;
    out[0] = (m12 + m21) / s;
    out[1] = 0.25 * s;
    out[2] = (m23 + m32) / s;
  } else {
    const s = 2 * Math.sqrt(1 + m33 - m11 - m22);
    out[3] = (m21 - m12) / s;
    out[0] = (m13 + m31) / s;
    out[1] = (m23 + m32) / s;
    out[2] = 0.25 * s;
  }
  return out;
}

/** q followed by a turn of `angle` radians about local +Y: q · (0, sin ½θ, 0, cos ½θ). */
export function turnAboutY(q: Quat, angle: number, out: Quat = q): Quat {
  const s = Math.sin(angle / 2);
  const c = Math.cos(angle / 2);
  const [x, y, z, w] = q;
  out[0] = x * c - z * s;
  out[1] = y * c + w * s;
  out[2] = z * c + x * s;
  out[3] = w * c - y * s;
  return out;
}
