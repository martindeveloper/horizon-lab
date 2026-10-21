/**
 * A drift on an orbit rig: the drift run's poses written to the rig each frame it plays, the
 * rig's own motion cancelled as a flight begins, and handoff shots given to the host (a
 * close-up on the same rig) until it resumes the drift from wherever it left the camera.
 */
import { createDriftRun, type DriftRunState, type DriftSettings, type DriftShot } from "../camera";
import type { OrbitRig } from "./orbit-rig";

export type RigDrift = ReturnType<typeof createRigDrift>;

export function createRigDrift(
  rig: Pick<OrbitRig, "pose" | "cancel" | "settle">,
  shots: readonly DriftShot[],
  settings: Partial<DriftSettings>,
  options: {
    /** Flies a handoff shot, each frame the drift waits on it; `resume` hands the camera back. */
    handoff?: (index: number, dt: number, resume: () => void) => void;
  } = {},
) {
  const run = createDriftRun(shots, settings);
  const resume = () => run.camera.resume(rig.pose);
  return {
    /** The camera is flying the drift (or waiting on a handoff) now. */
    get flying() {
      return run.flying;
    },
    /** Where the drift's flight under way lands (a host may fly alongside it); null between flights. */
    get landing() {
      return run.flying ? run.camera.landing : null;
    },
    /** How the drift was turning the camera at its last step, rad/s; through a handoff, as the host took it. */
    get motion() {
      return run.camera.motion;
    },
    /**
     * Flies the drift for this frame, or lets the rig be. `hold` keeps it from starting while
     * something else owns the camera. Call before the rig steps.
     */
    step(state: DriftRunState, dt: number, hold = false) {
      const result = run.step(state, rig.pose, dt, hold);
      if (result.started) rig.cancel();
      if (result.pose) {
        rig.pose.azimuth = result.pose.azimuth;
        rig.pose.inclination = result.pose.inclination;
        rig.pose.distance = result.pose.distance;
        rig.settle();
      } else if (result.handoff) options.handoff?.(run.camera.index, dt, resume);
      return result;
    },
  };
}
