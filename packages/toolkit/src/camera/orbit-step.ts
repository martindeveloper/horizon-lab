import { clamp } from "../math/index";
import type { OrbitPose } from "./flight";

/** Signed steps; `azimuth: 1` turns the scene left, `inclination: 1` tilts it down. */
export type OrbitTurn = { azimuth: number; inclination: number };

/** One button step, radians: 15°. */
export const ORBIT_STEP = Math.PI / 12;

export type OrbitStepOptions = {
  /** Radians per step; defaults to `ORBIT_STEP`. */
  step?: number;
  inclination?: { min: number; max: number };
};

/**
 * One discrete orbit step for buttons and keys (WCAG 2.5.7). Directions match
 * the drag: a left turn is a leftward drag, an up tilt is an upward drag. The
 * result snaps; callers that ease must still honour reduced motion.
 */
export function stepOrbit(pose: OrbitPose, turn: OrbitTurn, options: OrbitStepOptions = {}) {
  const step = options.step ?? ORBIT_STEP;
  const bounds = options.inclination ?? { min: -1.35, max: 1.35 };
  return {
    ...pose,
    azimuth: pose.azimuth + turn.azimuth * step,
    inclination: clamp(pose.inclination + turn.inclination * step, bounds.min, bounds.max),
  };
}
