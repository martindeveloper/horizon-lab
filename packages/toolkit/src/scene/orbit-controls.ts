/**
 * Drag, wheel and pinch on the canvas, driving an orbit rig: the angles follow at once, the
 * distance glides (or follows a pinch closely). `interacting` stays true for a moment after
 * the last input, so the frame loop keeps going while a gesture settles.
 */
import { createOrbitInput, type OrbitInputSource, type OrbitPose } from "../camera";
import type { DisposalScope } from "../rendering/disposal";
import { ORBIT_INCLINATION, type OrbitRig } from "./orbit-rig";

/** How long after the last input the scene still counts as handled. */
const RELEASE_MS = 700;

export function createOrbitControls(
  scope: DisposalScope,
  canvas: HTMLCanvasElement,
  rig: OrbitRig,
  options: {
    /** Asks the frame loop for a frame. */
    invalidate: () => void;
    /**
     * Bounds the input itself keeps to; the rig clamps to its own limits as it moves. Where the
     * rig's limits reach past them (a close-up's), the input follows the rig's.
     */
    distance: { min: number; max: number };
    /** Scales a drag's turn for the pose it starts from (see `createOrbitInput`). */
    dragScale?: (pose: OrbitPose) => number;
    /** Runs first, with what made the input; true when it took the input itself (another owner of the camera). */
    intercept?: (next: OrbitPose, source: OrbitInputSource) => boolean;
    /** After the pose follows an input. */
    onInput?: () => void;
  },
) {
  let interacting = false;
  let releaseTimer = 0;
  const bounds = {
    get min() {
      return Math.min(options.distance.min, rig.limits().min);
    },
    get max() {
      return Math.max(options.distance.max, rig.limits().max);
    },
  };
  const input = scope.own(
    createOrbitInput(canvas, {
      getPose: () => rig.inputPose(),
      onChange: (next, source) => {
        if (options.intercept?.(next, source)) return;
        rig.pose.azimuth = next.azimuth;
        rig.pose.inclination = next.inclination;
        /* A drag leaves the distance alone: a flight under way glides to rest instead. */
        if (next.distance !== rig.target) rig.zoomTo(next.distance, input.active);
        else rig.cancel();
        options.onInput?.();
        interacting = true;
        window.clearTimeout(releaseTimer);
        releaseTimer = window.setTimeout(() => {
          interacting = false;
          options.invalidate();
        }, RELEASE_MS);
        options.invalidate();
      },
      distance: bounds,
      inclination: ORBIT_INCLINATION,
      dragSensitivity: { azimuth: 0.0055, inclination: 0.0045 },
      ...(options.dragScale ? { dragScale: options.dragScale } : {}),
      wheelSensitivity: () => 0.0012,
    }),
  );
  scope.defer(() => window.clearTimeout(releaseTimer));

  return {
    /** A gesture is under way or has just ended. */
    get interacting() {
      return interacting;
    },
    /** Drops a gesture in progress (a flight or another owner takes the camera). */
    cancel: () => input.cancel(),
  };
}
