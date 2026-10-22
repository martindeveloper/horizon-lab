/**
 * HUD readouts an engine publishes a few times a second rather than every frame: a clock
 * that says when, the scale bar for the camera, and change tests so only news reaches a store.
 */
import type { DistanceChoice, DistanceUnit } from "../science";
import type { Viewport } from "./kit";
import { scaleBar } from "./scale-bar";

/** True once every `seconds` of frame time, or at once when forced. */
export function createReadoutClock(seconds = 0.25) {
  let clock = 0;
  return (dt: number, force: boolean) => {
    clock += dt;
    if (!(clock > seconds || force)) return false;
    clock = 0;
    return true;
  };
}

export type ScaleReadout = { scalePx: number; scaleValue: number; scaleUnit: DistanceUnit };

/** The scale bar for a camera `dist` world units (`world`) from its aim. */
export function scaleReadout(
  camera: { fov: number },
  viewport: Viewport,
  dist: number,
  world: DistanceUnit,
  choice: DistanceChoice,
): ScaleReadout {
  const { width, height } = viewport;
  const { value, unit, px } = scaleBar({ fov: camera.fov, dist, width, height, world, choice });
  return { scalePx: px, scaleValue: value, scaleUnit: unit };
}

export const scaleChanged = (next: ScaleReadout, now: ScaleReadout) =>
  next.scalePx !== now.scalePx ||
  next.scaleValue !== now.scaleValue ||
  next.scaleUnit !== now.scaleUnit;

/** `next` differs from `now` by more than `tolerance` of it. */
export const movedBy = (next: number, now: number, tolerance: number, floor = 1e-9) =>
  Math.abs(next - now) / Math.max(floor, Math.abs(now)) > tolerance;
