/**
 * The HUD's inertia: the projected displays hang on a spring against the ship, so a turn
 * leaves them trailing the way the scene slides, a burn presses them back, braking floats
 * them forward, and each settles with a little overshoot. Pure, so the motion is tested
 * without a DOM.
 */

/** Where the displays sit off their rest, px across and down, and their scale. */
export type Sway = { x: number; y: number; s: number; vx: number; vy: number; vs: number };

export const createSway = (): Sway => ({ x: 0, y: 0, s: 1, vx: 0, vy: 0, vs: 0 });

/** The spring's stiffness (1/s²) and damping (1/s): a quick, slightly lively settle. */
const STIFFNESS = 90;
const DAMPING = 13;
/** The longest step the spring takes at once, seconds; a longer frame is cut up. */
const LONGEST_STEP = 1 / 60;

/** Moves the displays `dt` seconds towards where the ship's motion pushes them. */
export function stepSway(sway: Sway, target: { x: number; y: number; s: number }, dt: number) {
  let left = Math.min(dt, 0.25);
  while (left > 0) {
    const h = Math.min(left, LONGEST_STEP);
    left -= h;
    const fade = Math.exp(-DAMPING * h);
    sway.vx = (sway.vx + (target.x - sway.x) * STIFFNESS * h) * fade;
    sway.vy = (sway.vy + (target.y - sway.y) * STIFFNESS * h) * fade;
    sway.vs = (sway.vs + (target.s - sway.s) * STIFFNESS * h) * fade;
    sway.x += sway.vx * h;
    sway.y += sway.vy * h;
    sway.s += sway.vs * h;
  }
  return sway;
}

/** At rest: on its mark and still, to a twentieth of a pixel. */
export const swaySettled = (sway: Sway, target: { x: number; y: number; s: number }) =>
  Math.abs(sway.x - target.x) < 0.05 &&
  Math.abs(sway.y - target.y) < 0.05 &&
  Math.abs(sway.s - target.s) < 1e-4 &&
  Math.abs(sway.vx) < 0.05 &&
  Math.abs(sway.vy) < 0.05 &&
  Math.abs(sway.vs) < 1e-4;
