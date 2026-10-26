import type { OrbitPose } from "@horizon/toolkit/camera";
/**
 * Close-ups: flying from a map to one body (a planet, a moon, a spacecraft) at its true size,
 * and back. Pure helpers, shared by the Orrery, Deep Field and the Sun; each engine owns the
 * state and the frame loop (a drift's visits: `./drift-visits`).
 */
import { TAU, clamp, lerp, smootherstep, wrapSigned } from "@horizon/toolkit/math";

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
 * three-quarters from the Sun, on whichever side of the sunward line is nearer the
 * current `azimuth`, so the flight in turns the least. `halfTan` is the tangent of
 * half the view's shorter free extent; the Sun itself keeps the current azimuth.
 */
export function closeUpPose(
  body: readonly [number, number, number],
  frameRadius: number,
  halfTan: number,
  azimuth: number,
): OrbitPose {
  const sunward = Math.hypot(body[0], body[2]) > 0 ? Math.atan2(-body[0], -body[2]) : null;
  const side = sunward === null || shortest(sunward, azimuth) >= 0 ? 1 : -1;
  return {
    azimuth: sunward === null ? azimuth : sunward + side * CLOSE_UP_SWING,
    inclination: CLOSE_UP_INCLINATION,
    distance: frameRadius / (halfTan * CLOSE_UP_FILL),
  };
}

/**
 * The same framing in an orbit frame whose up points at the Sun, for a body that swings round
 * it as the camera holds on (a probe on its orbit): the camera stands as far round from the
 * Sun as `closeUpPose` puts it, ahead of the body, so the light stays three-quarter.
 */
export function sunwardCloseUpPose(frameRadius: number, halfTan: number): OrbitPose {
  const fromSun = Math.acos(Math.cos(CLOSE_UP_INCLINATION) * Math.cos(CLOSE_UP_SWING));
  return {
    azimuth: 0,
    inclination: Math.PI / 2 - fromSun,
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

/** How a close-up's flights go, read as each one starts. */
export type CloseUpStyle = {
  /** How many times the usual flight time a flight takes. */
  pace: number;
  /** The zoom's lead on it (`sampleCloseUp`); 0 paces it evenly. */
  lead: number;
  /**
   * A scripted visit (a drift's), or null for the visitor's own. A scripted visit never stops
   * anything dead: its flight in carries on `motion` (rad/s, how the camera was already
   * turning), and a pause holds its flights where they are. A host may ease more with it (the
   * Orrery's clock).
   */
  scripted: { motion: Omit<OrbitPose, "distance"> } | null;
};

/** A visitor's close-up: flights at their own pace. */
export const TAP_STYLE: CloseUpStyle = { pace: 1, lead: 0, scripted: null };

/** Seconds a flight takes, in or out, at its style's pace. */
export const flightSeconds = (entering: boolean, { pace }: CloseUpStyle) =>
  (entering ? CLOSE_UP_IN_S : CLOSE_UP_OUT_S) * pace;

/**
 * The motion a flight sets off with, per whole flight: a scripted visit's flight in turns as
 * its drift was turning; any other flight carries on what the flight it interrupts was doing
 * (`velocity`, per second).
 */
export function settingOff(
  velocity: FlightMotion,
  entering: boolean,
  style: CloseUpStyle,
): FlightMotion {
  const seconds = flightSeconds(entering, style);
  const { azimuth, inclination, distance, look } =
    entering && style.scripted ? { ...STILL, ...style.scripted.motion } : velocity;
  return {
    azimuth: azimuth * seconds,
    inclination: inclination * seconds,
    distance: distance * seconds,
    look: [look[0] * seconds, look[1] * seconds, look[2] * seconds],
  };
}

/** The shorter way round from one angle to another, radians. */
export const shortest = (from: number, to: number) => wrapSigned(to - from, TAU);

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
