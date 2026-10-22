/**
 * A hand turning a globe. Dragging across a body turns it under the finger: sideways about its
 * pole (`twist`, radians on top of its spin), up and down tipping the pole towards or away
 * from us (`pitch`, radians on top of its tilt, never past either pole). Let go mid-flick and it
 * coasts to a stop; left alone for a while it eases home to the pose it had, the short way
 * round. Without three.js, so the engine and the tests share it.
 */
import { ORBIT_STEP, type OrbitTurn } from "@horizon/toolkit/camera";

import { GRAB_COAST_S, GRAB_HOLD_S, GRAB_RETURN_S } from "../parameters";

const TAU = 2 * Math.PI;
/** Below this a pose is home: a hundredth of a degree, far under a pixel on any globe. */
const HOME = 2e-4;

export type Pose = {
  twist: number;
  pitch: number;
  /** The hand's recent speed, radians a second, which a flick carries on. */
  twistRate: number;
  pitchRate: number;
  held: boolean;
  /** Seconds since the hand let go. */
  idle: number;
};

export const restPose = (): Pose => ({
  twist: 0,
  pitch: 0,
  twistRate: 0,
  pitchRate: 0,
  held: false,
  idle: 0,
});

export const poseRests = (pose: Pose) =>
  !pose.held &&
  pose.twist === 0 &&
  pose.pitch === 0 &&
  pose.twistRate === 0 &&
  pose.pitchRate === 0;

/** The pitch that keeps a globe of this tilt between its poles. */
const clampPitch = (pitch: number, tilt: number) =>
  Math.min(Math.PI / 2 - tilt, Math.max(-Math.PI / 2 - tilt, pitch));

/**
 * A drag of (dx, dy) CSS pixels across a globe of `radius` px over `dt` seconds: the point under
 * the finger follows it. Right turns the surface right (the turn falls, `turnAt`); down tips
 * the pole towards us.
 */
export function turnBy(
  pose: Pose,
  dx: number,
  dy: number,
  radius: number,
  tilt: number,
  dt: number,
) {
  const twist = -dx / radius;
  const pitch = clampPitch(pose.pitch + dy / radius, tilt) - pose.pitch;
  pose.held = true;
  pose.idle = 0;
  pose.twist += twist;
  pose.pitch += pitch;
  /* A smoothed speed, so one jittery event does not decide the flick. */
  if (dt > 0) {
    pose.twistRate = 0.7 * pose.twistRate + 0.3 * (twist / dt);
    pose.pitchRate = 0.7 * pose.pitchRate + 0.3 * (pitch / dt);
  }
}

/**
 * A button's turn (`OrbitTurn`, steps of `ORBIT_STEP` as the camera pad's): a flick that coasts
 * that far, directions as a drag's, then holds and goes home as a hand's turn does. Under reduced
 * motion it is there at once.
 */
export function nudge(pose: Pose, turn: OrbitTurn, tilt: number, reduce: boolean) {
  const twist = turn.azimuth * ORBIT_STEP;
  const pitch = clampPitch(pose.pitch + turn.inclination * ORBIT_STEP, tilt) - pose.pitch;
  pose.held = false;
  pose.idle = 0;
  if (reduce) {
    pose.twist += twist;
    pose.pitch += pitch;
    return;
  }
  /* A coast's speed falls by e every `GRAB_COAST_S`, so it carries the globe speed × that far. */
  pose.twistRate += twist / GRAB_COAST_S;
  pose.pitchRate += pitch / GRAB_COAST_S;
}

/** The hand lets go: still moving, the globe coasts on; at rest it stays where it was left. */
export function letGo(pose: Pose, moving: boolean) {
  pose.held = false;
  pose.idle = 0;
  if (!moving) {
    pose.twistRate = 0;
    pose.pitchRate = 0;
  }
}

/**
 * A free globe's next moment: it coasts, its speed fading over `GRAB_COAST_S`; after
 * `GRAB_HOLD_S` it heads home, covering all but 1/e of the way every `GRAB_RETURN_S`. Under
 * reduced motion it neither coasts nor glides: it holds, then is home at once.
 */
export function settlePose(pose: Pose, dt: number, tilt: number, reduce: boolean) {
  if (pose.held || poseRests(pose)) return;
  pose.idle += dt;
  if (reduce) {
    pose.twistRate = 0;
    pose.pitchRate = 0;
  } else {
    pose.twist += pose.twistRate * dt;
    pose.pitch = clampPitch(pose.pitch + pose.pitchRate * dt, tilt);
    const fade = Math.exp(-dt / GRAB_COAST_S);
    pose.twistRate *= fade;
    pose.pitchRate *= fade;
  }
  if (pose.idle < GRAB_HOLD_S) return;
  /* Home the short way round: a turn of 350° goes back 10°, not 350. */
  pose.twist -= TAU * Math.round(pose.twist / TAU);
  const keep = reduce ? 0 : Math.exp(-dt / GRAB_RETURN_S);
  pose.twist *= keep;
  pose.pitch *= keep;
  pose.twistRate *= keep;
  pose.pitchRate *= keep;
  if (Math.abs(pose.twist) < HOME && Math.abs(pose.pitch) < HOME) Object.assign(pose, restPose());
}
