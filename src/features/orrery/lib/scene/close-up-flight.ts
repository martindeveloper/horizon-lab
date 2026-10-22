import type { BodyId } from "@horizon/toolkit/bodies";
import type { OrbitPose } from "@horizon/toolkit/camera";
/**
 * Close-ups: flying from the map to one body at its true size, and back.
 * Pure helpers; the engine owns the state and the frame loop.
 */
import { TAU, clamp, dot3, lerp, smootherstep, wrapSigned } from "@horizon/toolkit/math";

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

export type Vec = readonly [number, number, number];

/**
 * The camera's motion as a flight sets off, per whole flight: how the angles turn, the
 * distance zooms (in e-folds) and the aim's look off the body (per distance, `aimAt`) moves.
 * A flight carries it on and eases it out (`carried`), so a flight that interrupts another,
 * or a visit that begins mid-orbit, never halts the camera dead. Parts not given are still.
 */
export type FlightMotion = { azimuth: number; inclination: number; distance: number; look: Vec };
export const STILL: FlightMotion = { azimuth: 0, inclination: 0, distance: 0, look: [0, 0, 0] };

const shortest = (from: number, to: number) => wrapSigned(to - from, TAU);

/**
 * 0..1 at rest at both ends, its speed rising as t² and settling as (1 − t)⁴: most of the
 * way early, then a long, gentle landing.
 */
const early = (t: number) => t ** 3 * (35 - t * (105 - t * (126 - t * (70 - 15 * t))));

/** Smootherstep, skewed by `lead` (0..1) toward `early`; reversed, `late` lifts off gently instead. */
const ease = (t: number, lead: number) => lerp(smootherstep(t), early(t), lead);
const late = (t: number, lead: number) => 1 - ease(1 - t, lead);

/** Leaves at speed 1 and lands at rest back at 0: a turn already under way, carried on and eased out. */
const carried = (t: number) => t * (1 - t * t * (6 - t * (8 - 3 * t)));

/**
 * Pose and aim blend `t` (0..1) of the way through a close-up flight. Going in,
 * the view pans onto the body first and dives after; coming out it pulls back
 * first and pans home after (`aimAt` keeps the body in frame meanwhile).
 * Distance moves in log space: 10 au to a few thousand km reads as one dive.
 * `lead` (0..1) spends more of the flight where the body is large: the dive
 * covers its far reaches early and settles slowly onto the body, and the pull
 * back leaves the body slowly before it falls away; 0 paces the zoom evenly.
 * Either way the zoom leaves and lands at rest, never braking hard. `motion` is how the
 * camera was already moving as the flight set off (`FlightMotion`): it carries on and eases
 * out, so a camera that was orbiting, or mid-flight, never halts as the flight takes it;
 * `carry` is how much of it is left, for the aim's look (`aimAt`).
 */
export function sampleCloseUp(
  t: number,
  from: OrbitPose,
  to: OrbitPose,
  entering: boolean,
  lead = 0,
  motion: Partial<FlightMotion> = STILL,
) {
  const aim = entering
    ? smootherstep(clamp(t / 0.55, 0, 1))
    : smootherstep(clamp((t - 0.3) / 0.7, 0, 1));
  const zoom = entering
    ? ease(clamp((t - 0.12) / 0.88, 0, 1), clamp(lead, 0, 1))
    : late(clamp(t / 0.85, 0, 1), clamp(lead, 0, 1));
  const turn = smootherstep(t);
  const carry = carried(t);
  const { azimuth: turning = 0, inclination: tilting = 0, distance: zooming = 0 } = motion;
  return {
    aim,
    carry,
    pose: {
      azimuth: from.azimuth + shortest(from.azimuth, to.azimuth) * turn + turning * carry,
      inclination: lerp(from.inclination, to.inclination, turn) + tilting * carry,
      distance: Math.exp(
        lerp(Math.log(from.distance), Math.log(to.distance), zoom) + zooming * carry,
      ),
    } satisfies OrbitPose,
  };
}

/**
 * Where the camera looks, off the body at `body`: `blend` (0..1) of the way from `from.look`
 * (as seen from `from.distance`) to `to.look` (as seen from `to.distance`), both offsets from
 * the body, with the camera `distance` from the aim. The body moves across the view by that
 * blend however far the zoom has gone, so a dive or a pull back that outruns the pan never
 * loses it from the frame, and the aim moves on with the body as it travels. `motion` is how
 * the look was moving as the flight set off (per distance, per whole flight) and `carry` how
 * much of it the flight still carries (`sampleCloseUp`).
 */
export function aimAt(
  body: Vec,
  from: { look: Vec; distance: number },
  to: { look: Vec; distance: number },
  distance: number,
  blend: number,
  motion: Vec = STILL.look,
  carry = 0,
): [number, number, number] {
  const at = (k: 0 | 1 | 2) =>
    body[k] +
    distance *
      (lerp(from.look[k] / from.distance, to.look[k] / to.distance, blend) + motion[k] * carry);
  return [at(0), at(1), at(2)];
}

/** Where the swing puts the moon: this share of the free half-view off the body. */
export const MOON_FILL = 0.6;
/** Steepest tilt the swing turns to, so it never looks straight down a pole. */
const MOON_TILT = 0.6;

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
  const toward = dot3(now, moon) / (r * r);
  const x = now[0] - toward * moon[0];
  const y = now[1] - toward * moon[1];
  const z = now[2] - toward * moon[2];
  const level = Math.hypot(x, z);
  const azimuth =
    level > 1e-9 ? base.azimuth + shortest(base.azimuth, Math.atan2(x, z)) : base.azimuth;
  const inclination = clamp(Math.atan2(y, level), -MOON_TILT, MOON_TILT);
  const along = dot3(cameraDirection({ azimuth, inclination }), moon);
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
