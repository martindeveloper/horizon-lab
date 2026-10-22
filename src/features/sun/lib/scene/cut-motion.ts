/**
 * The wedge as drawn: its opening eases on a timed curve from where it stood to the setting, so
 * it lands rather than crawls the last degrees (a new setting starts over from where it is), and
 * its bisector follows the camera's azimuth round the pole. Writes the shader's `uCut`.
 */
import type { Vector2, Vector3 } from "three";

import { easeToward } from "@horizon/toolkit/camera";
import { lerp, smootherstep, wrapSigned } from "@horizon/toolkit/math";

import { CUT_HALF_ANGLE, CUT_LAG_S, CUT_TRAVEL_S } from "../parameters";

/** The wedge's bisector that faces a point: its azimuth round the pole as the shader reads it. */
const bisectorOf = (p: Vector3) => Math.PI / 2 - Math.atan2(p.x, p.z);

export function createCutMotion(
  cut: Vector2,
  open: number,
  camera: Vector3,
  reduceMotion: MediaQueryList,
) {
  let shown = open;
  let from = open;
  let to = open;
  let t = 1;
  let moving = false;
  cut.x = shown * CUT_HALF_ANGLE;
  cut.y = bisectorOf(camera);
  return {
    /** How far open the wedge is drawn, 0–1. */
    get shown() {
      return shown;
    },
    /** The wedge opens, closes or turns. */
    get moving() {
      return moving;
    },
    step(dt: number, setting: number) {
      if (setting !== to) {
        from = shown;
        to = setting;
        t = 0;
      }
      const span = Math.abs(to - from) * CUT_TRAVEL_S;
      t = reduceMotion.matches || span <= 0 ? 1 : Math.min(1, t + dt / span);
      shown = lerp(from, to, smootherstep(t));
      cut.x = shown * CUT_HALF_ANGLE;
      const gap = wrapSigned(bisectorOf(camera) - cut.y, Math.PI * 2);
      cut.y += easeToward(0, gap, dt, CUT_LAG_S, reduceMotion.matches);
      moving = t < 1 || (Math.abs(gap) > 1e-3 && shown > 0);
    },
  };
}
