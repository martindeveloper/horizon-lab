/**
 * A drift on an orbit rig: the drift run's poses written to the rig each frame it plays, the
 * rig's own motion cancelled as a flight begins, and handoff shots given to the host (a
 * close-up on the same rig) until it resumes the drift from wherever it left the camera.
 */
import {
  createDriftRun,
  type DriftRunState,
  type DriftSettings,
  type DriftShot,
  type FreeLook,
} from "../camera";
import type { OrbitRig } from "./orbit-rig";

export type RigDrift = ReturnType<typeof createRigDrift>;

/** Where a camera looks off its aim and how it is tilted: the part of a drawn pose a rig does not hold. */
export type RigAttitude = { look: FreeLook; roll: number };

export function createRigDrift(
  rig: Pick<OrbitRig, "pose" | "cancel" | "settle">,
  shots: readonly DriftShot[],
  settings: Partial<DriftSettings>,
  options: {
    /** Flies a handoff shot, each frame the drift waits on it; `resume` hands the camera back. */
    handoff?: (index: number, dt: number, resume: () => void) => void;
    /**
     * The host's camera looks off the rig's aim (a host that draws shots' `look` and `roll`):
     * the drift starts and resumes from that attitude, so it flies on from the very view shown.
     */
    attitude?: () => RigAttitude;
  } = {},
) {
  const run = createDriftRun(shots, settings);
  const current = () => (options.attitude ? { ...rig.pose, ...options.attitude() } : rig.pose);
  const resume = () => run.camera.resume(current());
  /** The drawn pose's look and roll; the rig keeps the rest. */
  const attitude: RigAttitude = { look: { yaw: 0, pitch: 0 }, roll: 0 };
  return {
    /** The camera is flying the drift (or waiting on a handoff) now. */
    get flying() {
      return run.flying;
    },
    /** Where the drift's flight under way lands (a host may fly alongside it); null between flights. */
    get landing() {
      return run.flying ? run.camera.landing : null;
    },
    /** The shot the drift is flying to or holding, −1 before its first. */
    get shot() {
      return run.camera.index;
    },
    /** How the drift was turning the camera at its last step, rad/s; through a handoff, as the host took it. */
    get motion() {
      return run.camera.motion;
    },
    /** Where the drawn pose looks off the aim, and its tilt, as of the last frame the drift drew; for a host that draws them. */
    get attitude(): Readonly<RigAttitude> {
      return attitude;
    },
    /**
     * Flies the drift for this frame, or lets the rig be. `hold` keeps it from starting while
     * something else owns the camera. Call before the rig steps.
     */
    step(state: DriftRunState, dt: number, hold = false) {
      const result = run.step(state, current(), dt, hold);
      if (result.started) rig.cancel();
      if (result.pose) {
        rig.pose.azimuth = result.pose.azimuth;
        rig.pose.inclination = result.pose.inclination;
        rig.pose.distance = result.pose.distance;
        rig.settle();
        attitude.look.yaw = result.pose.look.yaw;
        attitude.look.pitch = result.pose.look.pitch;
        attitude.roll = result.pose.roll;
      } else if (result.handoff) options.handoff?.(run.camera.index, dt, resume);
      return result;
    },
  };
}
