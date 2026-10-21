import type { BodyId } from "@horizon/toolkit/bodies";
import type { OrbitPose } from "@horizon/toolkit/camera";
/**
 * Close-ups: flying from the map to one body at its true size, and back.
 * Pure helpers; the engine owns the state and the frame loop.
 */
import { clamp, lerp, smootherstep } from "@horizon/toolkit/math";

/** Seconds for the flight in (pan, then dive) and back out (pull back, then pan). */
export const CLOSE_UP_IN_S = 3.4;
export const CLOSE_UP_OUT_S = 2.4;
/** The framed body's apparent radius, as a fraction of half the shorter side of the view. */
export const CLOSE_UP_FILL = 0.55;
/** Nearest approach in body radii from the centre, and farthest in framing radii. */
const CLOSE_UP_NEAREST = 1.3;
const CLOSE_UP_FARTHEST = 40;
/** Arrival angles: this far round from the Sun (three-quarter light) and above the ecliptic. */
export const CLOSE_UP_SWING = 0.9;
const CLOSE_UP_INCLINATION = 0.3;

/**
 * The pose that frames a body of `frameRadius` (scene units) at `body`, lit
 * three-quarters from the Sun. `halfTan` is the tangent of half the view's
 * shorter free extent; the Sun itself keeps the current azimuth.
 */
export function closeUpPose(
  body: readonly [number, number, number],
  frameRadius: number,
  halfTan: number,
  azimuth: number,
): OrbitPose {
  const sunward = Math.hypot(body[0], body[2]) > 0 ? Math.atan2(-body[0], -body[2]) : null;
  return {
    azimuth: sunward === null ? azimuth : sunward + CLOSE_UP_SWING,
    inclination: CLOSE_UP_INCLINATION,
    distance: frameRadius / (halfTan * CLOSE_UP_FILL),
  };
}

/** Zoom limits around a framed body, scene units. */
export function closeUpLimits(radius: number, frameRadius: number) {
  return { min: radius * CLOSE_UP_NEAREST, max: frameRadius * CLOSE_UP_FARTHEST };
}

const TAU = Math.PI * 2;

const shortest = (from: number, to: number) =>
  ((((to - from + Math.PI) % TAU) + TAU) % TAU) - Math.PI;

/** Monotonic time warp with fixed ends; positive `l` front-loads, negative back-loads. */
function warp(t: number, l: number) {
  const p = 1 + 1.6 * Math.abs(l);
  return l >= 0 ? 1 - (1 - t) ** p : t ** p;
}

/**
 * Pose and aim blend `t` (0..1) of the way through a close-up flight. Going in,
 * the view pans onto the body first and dives after; coming out it pulls back
 * first and pans home after, so the body never leaves the frame mid-flight.
 * Distance moves in log space: 10 au to a few thousand km reads as one dive.
 * `lead` (0..1) spends more of the flight where the body is large: the dive
 * covers its far reaches early and settles slowly onto the body, and the pull
 * back leaves the body slowly before it falls away; 0 paces the zoom evenly.
 */
export function sampleCloseUp(
  t: number,
  from: OrbitPose,
  to: OrbitPose,
  entering: boolean,
  lead = 0,
) {
  const aim = entering
    ? smootherstep(clamp(t / 0.55, 0, 1))
    : smootherstep(clamp((t - 0.3) / 0.7, 0, 1));
  const zoom = entering
    ? smootherstep(warp(clamp((t - 0.12) / 0.88, 0, 1), lead))
    : smootherstep(warp(clamp(t / 0.85, 0, 1), -lead));
  const turn = smootherstep(t);
  return {
    aim,
    pose: {
      azimuth: from.azimuth + shortest(from.azimuth, to.azimuth) * turn,
      inclination: lerp(from.inclination, to.inclination, turn),
      distance: Math.exp(lerp(Math.log(from.distance), Math.log(to.distance), zoom)),
    } satisfies OrbitPose,
  };
}

/** Where the swing puts the moon: this share of the free half-view off the body. */
export const MOON_FILL = 0.6;
/** Steepest tilt the swing turns to, so it never looks straight down a pole. */
const MOON_TILT = 0.6;

type Vec = readonly [number, number, number];
const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cameraDirection = ({ azimuth, inclination }: Omit<OrbitPose, "distance">): Vec => [
  Math.cos(inclination) * Math.sin(azimuth),
  Math.sin(inclination),
  Math.cos(inclination) * Math.cos(azimuth),
];

/**
 * The pose that frames a body with its moon (`moon`, its offset from the body): from `base`,
 * turned the least way to see the pair side-on, and pulled back until the moon sits
 * `MOON_FILL` of the way to the edge of the free view (`halfTan`). Never nearer than `base`.
 */
export function moonFraming(moon: Vec, base: OrbitPose, halfTan: number): OrbitPose {
  const r = Math.hypot(...moon);
  const now = cameraDirection(base);
  const toward = dot(now, moon) / (r * r);
  const x = now[0] - toward * moon[0];
  const y = now[1] - toward * moon[1];
  const z = now[2] - toward * moon[2];
  const level = Math.hypot(x, z);
  const azimuth =
    level > 1e-9 ? base.azimuth + shortest(base.azimuth, Math.atan2(x, z)) : base.azimuth;
  const inclination = clamp(Math.atan2(y, level), -MOON_TILT, MOON_TILT);
  const along = dot(cameraDirection({ azimuth, inclination }), moon);
  const across = Math.sqrt(Math.max(0, r * r - along * along));
  return {
    azimuth,
    inclination,
    distance: Math.max(base.distance, along + across / (halfTan * MOON_FILL)),
  };
}

/**
 * How far into the swing to the moon a hold is at `t` (0..1 of the hold): out between the
 * first two marks, there until the third, back by the fourth. Marks that leave no time to come
 * back (`home` at or before `back`) keep the camera out at the moon to the end of the hold, so
 * the flight out leaves from there and the body is pulled away from only once.
 */
export function moonSwing(t: number, [out, there, back, home]: MoonSwing) {
  const go = smootherstep(clamp((t - out) / (there - out), 0, 1));
  if (home <= back) return go;
  return go * (1 - smootherstep(clamp((t - back) / (home - back), 0, 1)));
}
export type MoonSwing = readonly [out: number, there: number, back: number, home: number];

/** Width of the detailed map painted for a close-up; nearly featureless bodies need less. */
export function closeUpMapWidth(id: BodyId, light: boolean) {
  const plain = id === "uranus" || id === "neptune" || id === "sun";
  if (plain) return light ? 512 : 1024;
  return light ? 1024 : 2048;
}
