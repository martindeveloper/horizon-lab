/**
 * Free camera: a position and an attitude, with no aim point and no rig. Pure maths on plain
 * tuples, so a raymarched scene, a three.js camera and a floating-origin host share it: the
 * attitude is the camera-to-world quaternion in three's camera convention (local −Z looks into
 * the scene, +Y is up, +X right), so `camera.quaternion.fromArray(pose.orientation)` applies it.
 * The host owns the pose and may overwrite it every frame; nothing here holds on to it.
 */
import { clamp, lerp, smootherstep } from "../math";
import type { OrbitPose } from "./flight";

export type Vec3 = [x: number, y: number, z: number];
export type Quat = [x: number, y: number, z: number, w: number];

export type FreePose = { position: Vec3; orientation: Quat };

/** The camera's axes in world space: right, up, and forward into the scene. */
export type FreeBasis = { right: Vec3; up: Vec3; fwd: Vec3 };

/** A move request in the camera's own axes, each −1…1 (forward looks into the scene). */
export type FreeMove = { right: number; up: number; forward: number };

const WORLD_UP: Vec3 = [0, 1, 0];
/** Pitch stops this far short of straight up or down, radians, so the horizon stays defined. */
const PITCH_LIMIT = Math.PI / 2 - 0.02;

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
function normalize(v: Vec3): Vec3 {
  const length = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / length, v[1] / length, v[2] / length];
}

function normalizeQuat(q: Quat): Quat {
  const length = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
  return [q[0] / length, q[1] / length, q[2] / length, q[3] / length];
}

/** The product a·b: b's rotation first, then a's. */
export function multiplyQuat(a: Quat, b: Quat): Quat {
  const [ax, ay, az, aw] = a;
  const [bx, by, bz, bw] = b;
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ];
}

/** The rotation by `angle` radians about the unit `axis`. */
export function axisAngle(axis: Vec3, angle: number): Quat {
  const s = Math.sin(angle / 2);
  return [axis[0] * s, axis[1] * s, axis[2] * s, Math.cos(angle / 2)];
}

/** `v` rotated by the unit quaternion `q`. */
export function rotateVec(q: Quat, v: Vec3): Vec3 {
  const [x, y, z, w] = q;
  // v + 2w(u×v) + 2u×(u×v), with u the vector part.
  const tx = 2 * (y * v[2] - z * v[1]);
  const ty = 2 * (z * v[0] - x * v[2]);
  const tz = 2 * (x * v[1] - y * v[0]);
  return [
    v[0] + w * tx + (y * tz - z * ty),
    v[1] + w * ty + (z * tx - x * tz),
    v[2] + w * tz + (x * ty - y * tx),
  ];
}

/** Spherical interpolation along the shorter arc; `t` is not eased. */
export function slerpQuat(a: Quat, b: Quat, t: number): Quat {
  let cos = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  const sign = cos < 0 ? -1 : 1;
  cos *= sign;
  if (cos > 0.9995)
    return normalizeQuat([
      lerp(a[0], sign * b[0], t),
      lerp(a[1], sign * b[1], t),
      lerp(a[2], sign * b[2], t),
      lerp(a[3], sign * b[3], t),
    ]);
  const angle = Math.acos(cos);
  const sa = Math.sin((1 - t) * angle) / Math.sin(angle);
  const sb = (sign * Math.sin(t * angle)) / Math.sin(angle);
  return [
    sa * a[0] + sb * b[0],
    sa * a[1] + sb * b[1],
    sa * a[2] + sb * b[2],
    sa * a[3] + sb * b[3],
  ];
}

/** The quaternion whose rotation takes the axes to the orthonormal columns right, up, back. */
function quatFromAxes(right: Vec3, up: Vec3, back: Vec3): Quat {
  const [m00, m10, m20] = right;
  const [m01, m11, m21] = up;
  const [m02, m12, m22] = back;
  const trace = m00 + m11 + m22;
  if (trace > 0) {
    const s = 0.5 / Math.sqrt(trace + 1);
    return [(m21 - m12) * s, (m02 - m20) * s, (m10 - m01) * s, 0.25 / s];
  }
  if (m00 > m11 && m00 > m22) {
    const s = 2 * Math.sqrt(1 + m00 - m11 - m22);
    return [0.25 * s, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s];
  }
  if (m11 > m22) {
    const s = 2 * Math.sqrt(1 + m11 - m00 - m22);
    return [(m01 + m10) / s, 0.25 * s, (m12 + m21) / s, (m02 - m20) / s];
  }
  const s = 2 * Math.sqrt(1 + m22 - m00 - m11);
  return [(m02 + m20) / s, (m12 + m21) / s, 0.25 * s, (m10 - m01) / s];
}

/** The camera's world axes for an attitude. */
export function freeBasis(orientation: Quat): FreeBasis {
  const back = rotateVec(orientation, [0, 0, 1]);
  return {
    right: rotateVec(orientation, [1, 0, 0]),
    up: rotateVec(orientation, [0, 1, 0]),
    fwd: [-back[0], -back[1], -back[2]],
  };
}

/**
 * The attitude looking along `fwd`, its right level with `up` (world +Y by default), then
 * rolled `roll` radians: a positive roll turns right toward up, as a Dutch tilt to the left.
 * Looking straight along `up` keeps a right of +X.
 */
export function lookRotation(fwd: Vec3, up: Vec3 = WORLD_UP, roll = 0): Quat {
  const back = normalize([-fwd[0], -fwd[1], -fwd[2]]);
  let right = cross(up, back);
  right = Math.hypot(...right) < 1e-9 ? [1, 0, 0] : normalize(right);
  const level = quatFromAxes(right, cross(back, right), back);
  return roll === 0 ? level : multiplyQuat(level, axisAngle([0, 0, 1], roll));
}

/**
 * Where the camera looks relative to its aim, radians: `yaw` turns left of the aim about the
 * camera's up, `pitch` lifts above it. Zero looks straight at the aim.
 */
export type FreeLook = { yaw: number; pitch: number };

/**
 * An orbit pose with its tilt and where it looks: a free pose written about an aim point. `ride`
 * (0–1) is how far it moves with the scene's own flow; the pose maths here ignores it.
 */
export type AimedPose = OrbitPose & { roll?: number; look?: FreeLook; ride?: number };

/**
 * The orbit convention every rig here uses, as a free pose: the camera at `distance` from `aim`,
 * at `azimuth` about +Y from +Z and `inclination` above the XZ plane, facing the aim, its right
 * level; then turned by `look` and rolled `roll` about the line of sight (positive tilts right
 * toward up).
 */
export function freeFromOrbit(pose: AimedPose, aim: Vec3 = [0, 0, 0]): FreePose {
  const c = Math.cos(pose.inclination);
  const offset: Vec3 = [
    pose.distance * c * Math.sin(pose.azimuth),
    pose.distance * Math.sin(pose.inclination),
    pose.distance * c * Math.cos(pose.azimuth),
  ];
  let orientation = lookRotation([-offset[0], -offset[1], -offset[2]]);
  const look = pose.look;
  if (look && look.yaw !== 0)
    orientation = multiplyQuat(orientation, axisAngle(WORLD_UP, look.yaw));
  if (look && look.pitch !== 0)
    orientation = multiplyQuat(orientation, axisAngle([1, 0, 0], look.pitch));
  if (pose.roll) orientation = multiplyQuat(orientation, axisAngle([0, 0, 1], pose.roll));
  return {
    position: [aim[0] + offset[0], aim[1] + offset[1], aim[2] + offset[2]],
    orientation: normalizeQuat(orientation),
  };
}

/** The inverse of `freeFromOrbit`: where a free pose sits on the orbit about `aim`, its tilt and look. */
export function orbitFromFree(
  pose: FreePose,
  aim: Vec3 = [0, 0, 0],
): Required<Omit<AimedPose, "ride">> {
  const x = pose.position[0] - aim[0];
  const y = pose.position[1] - aim[1];
  const z = pose.position[2] - aim[2];
  const distance = Math.hypot(x, y, z);
  const aimed = lookRotation([-x, -y, -z]);
  /* The attitude in the aimed frame is yaw · pitch · roll; read them back off its axes. */
  const conj: Quat = [-aimed[0], -aimed[1], -aimed[2], aimed[3]];
  const local = freeBasis(multiplyQuat(conj, pose.orientation));
  const yaw = Math.atan2(-local.fwd[0], -local.fwd[2]);
  const pitch = Math.asin(clamp(local.fwd[1], -1, 1));
  const level: Vec3 = [Math.cos(yaw), 0, -Math.sin(yaw)];
  const raised: Vec3 = [
    Math.sin(pitch) * Math.sin(yaw),
    Math.cos(pitch),
    Math.sin(pitch) * Math.cos(yaw),
  ];
  return {
    azimuth: Math.atan2(x, z),
    inclination: distance > 0 ? Math.asin(clamp(y / distance, -1, 1)) : 0,
    distance,
    roll: Math.atan2(dot(local.right, raised), dot(local.right, level)),
    look: { yaw, pitch },
  };
}

/**
 * Turns an attitude as a head does: `yaw` about world up (positive turns left), `pitch` about
 * the camera's right (positive looks up, stopping short of straight up or down), `roll` about
 * its line of sight (positive tilts right toward up).
 */
export function turnFree(orientation: Quat, yaw: number, pitch: number, roll = 0): Quat {
  const fwd = freeBasis(orientation).fwd;
  const now = Math.asin(clamp(fwd[1], -1, 1));
  const lift = clamp(now + pitch, -PITCH_LIMIT, PITCH_LIMIT) - now;
  let q = orientation;
  if (lift !== 0) q = multiplyQuat(q, axisAngle([1, 0, 0], lift));
  if (roll !== 0) q = multiplyQuat(q, axisAngle([0, 0, 1], roll));
  if (yaw !== 0) q = multiplyQuat(axisAngle(WORLD_UP, yaw), q);
  return normalizeQuat(q);
}

/** The pose turned `angle` radians about `axis` (unit) through `about`: a glide around a centre. */
export function revolveFree(
  pose: FreePose,
  angle: number,
  axis: Vec3 = WORLD_UP,
  about: Vec3 = [0, 0, 0],
): FreePose {
  if (angle === 0) return pose;
  const turn = axisAngle(axis, angle);
  const r = rotateVec(turn, [
    pose.position[0] - about[0],
    pose.position[1] - about[1],
    pose.position[2] - about[2],
  ]);
  return {
    position: [about[0] + r[0], about[1] + r[1], about[2] + r[2]],
    orientation: normalizeQuat(multiplyQuat(turn, pose.orientation)),
  };
}

export type FreeFlightOptions = {
  /**
   * Fly around this point rather than straight: the direction from it turns on a great circle
   * and the distance eases geometrically, so a flight never cuts through what sits there and a
   * push-in keeps an even apparent pace.
   */
  about?: Vec3;
};

/** The camera `t` (0–1, eased here) of the way from `from` to `to`; the attitude turns on the shorter arc. */
export function sampleFreeFlight(
  t: number,
  from: FreePose,
  to: FreePose,
  options: FreeFlightOptions = {},
): FreePose {
  if (t <= 0) return { position: [...from.position], orientation: [...from.orientation] };
  if (t >= 1) return { position: [...to.position], orientation: [...to.orientation] };
  const e = smootherstep(t);
  const orientation = slerpQuat(from.orientation, to.orientation, e);
  const about = options.about;
  if (!about)
    return {
      position: [
        lerp(from.position[0], to.position[0], e),
        lerp(from.position[1], to.position[1], e),
        lerp(from.position[2], to.position[2], e),
      ],
      orientation,
    };
  const a: Vec3 = [
    from.position[0] - about[0],
    from.position[1] - about[1],
    from.position[2] - about[2],
  ];
  const b: Vec3 = [to.position[0] - about[0], to.position[1] - about[1], to.position[2] - about[2]];
  const ra = Math.hypot(...a);
  const rb = Math.hypot(...b);
  const radius = ra > 0 && rb > 0 ? ra * (rb / ra) ** e : lerp(ra, rb, e);
  const ua = normalize(a);
  const ub = normalize(b);
  const angle = Math.acos(clamp(dot(ua, ub), -1, 1));
  let dir: Vec3;
  if (angle < 1e-6) dir = ua;
  else {
    /* Opposite ends turn over the top: about any axis square to the start, world up first. */
    let axis = cross(ua, ub);
    if (Math.hypot(...axis) < 1e-6) axis = cross(ua, Math.abs(ua[1]) < 0.9 ? WORLD_UP : [1, 0, 0]);
    dir = rotateVec(axisAngle(normalize(axis), angle * e), ua);
  }
  return {
    position: [about[0] + dir[0] * radius, about[1] + dir[1] * radius, about[2] + dir[2] * radius],
    orientation,
  };
}

/** `current` eased toward `target` with time constant `tau` seconds; at once when `instant`. */
export function easeToward(
  current: number,
  target: number,
  dt: number,
  tau: number,
  instant = false,
) {
  if (instant || tau <= 0) return target;
  return current + (target - current) * (1 - Math.exp(-dt / tau));
}

export type FreeFlyOptions = {
  /** Top speed, world units per second, for this position (e.g. slower close to a body). */
  speed: (position: Vec3) => number;
  /** Seconds the velocity takes to follow the request; 0.25 by default. */
  smoothing?: number;
  /** While it matches, the velocity follows the request at once. */
  reduceMotion?: { matches: boolean };
  /** Keeps the position somewhere allowed, in place (e.g. outside a horizon). */
  constrain?: (position: Vec3) => void;
};

/**
 * One frame of kinematic flight: the velocity (world units per second, kept by the host and
 * updated in place) eases toward `move` along the camera's axes times the speed and `boost`,
 * and the position moves by it. Returns the new position; the attitude is the host's.
 */
export function stepFreeFly(
  pose: FreePose,
  velocity: Vec3,
  move: FreeMove,
  boost: number,
  dt: number,
  options: FreeFlyOptions,
): Vec3 {
  const { right, up, fwd } = freeBasis(pose.orientation);
  const speed = options.speed(pose.position) * (1 + 4 * clamp(boost, 0, 1));
  const instant = options.reduceMotion?.matches === true;
  const tau = options.smoothing ?? 0.25;
  for (let i = 0; i < 3; i++) {
    const want = (right[i]! * move.right + up[i]! * move.up + fwd[i]! * move.forward) * speed;
    velocity[i] = easeToward(velocity[i]!, want, dt, tau, instant);
  }
  const position: Vec3 = [
    pose.position[0] + velocity[0] * dt,
    pose.position[1] + velocity[1] * dt,
    pose.position[2] + velocity[2] * dt,
  ];
  options.constrain?.(position);
  return position;
}

/**
 * The camera-to-world matrix, column-major as WebGL and three's `matrixWorld.elements` lay it
 * out: columns right, up, back (−forward) and the position. A shader reads the ray through
 * uv (scaled by tan(fov / 2)) as `mat3(m) * vec3(uv, -1.0)` from `m[3].xyz`.
 */
export function writeCameraMatrix(out: { [index: number]: number }, pose: FreePose) {
  const { right, up, fwd } = freeBasis(pose.orientation);
  out[0] = right[0];
  out[1] = right[1];
  out[2] = right[2];
  out[3] = 0;
  out[4] = up[0];
  out[5] = up[1];
  out[6] = up[2];
  out[7] = 0;
  out[8] = -fwd[0];
  out[9] = -fwd[1];
  out[10] = -fwd[2];
  out[11] = 0;
  out[12] = pose.position[0];
  out[13] = pose.position[1];
  out[14] = pose.position[2];
  out[15] = 1;
  return out;
}
