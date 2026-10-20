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

/** Radius to frame, in equatorial radii: Saturn's bright rings, Halley's glow. */
export const FRAME_RADII: Partial<Record<BodyId, number>> = { saturn: 2.3, halley: 2.2 };

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

/**
 * Pose and aim blend `t` (0..1) of the way through a close-up flight. Going in,
 * the view pans onto the body first and dives after; coming out it pulls back
 * first and pans home after, so the body never leaves the frame mid-flight.
 * Distance moves in log space: 10 au to a few thousand km reads as one dive.
 */
export function sampleCloseUp(t: number, from: OrbitPose, to: OrbitPose, entering: boolean) {
  const aim = entering
    ? smootherstep(clamp(t / 0.55, 0, 1))
    : smootherstep(clamp((t - 0.3) / 0.7, 0, 1));
  const zoom = entering
    ? smootherstep(clamp((t - 0.12) / 0.88, 0, 1))
    : smootherstep(clamp(t / 0.85, 0, 1));
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

/** Width of the detailed map painted for a close-up; nearly featureless bodies need less. */
export function closeUpMapWidth(id: BodyId, light: boolean) {
  const plain = id === "uranus" || id === "neptune" || id === "sun";
  if (plain) return light ? 512 : 1024;
  return light ? 1024 : 2048;
}
