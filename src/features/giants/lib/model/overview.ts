/**
 * The overview: every body at once. Their radii span ten powers of ten, more than any one
 * true-scale view can show, so it is a dot plot: a row for each body, the largest at the top,
 * its name in a column down the left and its dot where its radius falls on a log axis along the
 * horizon. A dot grows with the log of the radius, as the dock's strip sizes them. The scale
 * lines mark round radii in the ruler's units. Without the DOM or WebGL: the engine places the
 * dots and names, the stage's labels draw the lines from the same shares of the axis.
 */
import { clamp, lerp, smootherstep, smoothstep, toLogFraction } from "@horizon/toolkit/math";

import {
  MIN_DISC_PX,
  OVERVIEW_AXIS_INSET_PX,
  OVERVIEW_DOT_PX,
  OVERVIEW_FOOT_PX,
  OVERVIEW_MARGIN_PX,
  OVERVIEW_NAMES_NARROW_PX,
  OVERVIEW_NAMES_PX,
  OVERVIEW_NARROW_PX,
  OVERVIEW_ROW_FILL,
  OVERVIEW_SECONDS,
  OVERVIEW_SWAP,
  OVERVIEW_TOP_PX,
} from "../parameters";
import { radiusMetres } from "./catalogue";
import { blankPlaced, type Ladder, type Placed, type Stage } from "./ladder";
import { METRES, rulerUnits, unitFor, type Ruler, type RulerUnit } from "./ruler";
import { RUNG_IDS } from "./rungs";

/** The axis's ends: the smallest radius on the ladder and the largest, metres. */
export type Axis = { min: number; max: number };

export function axisOf(sizes: readonly { radius: number }[]): Axis {
  const radii = sizes.map((size) => size.radius);
  return { min: Math.min(...radii), max: Math.max(...radii) };
}

/** The ladder's axis: the engine's dots and the stage's lines both stand on it. */
export const OVERVIEW_AXIS = axisOf(RUNG_IDS.map((id) => radiusMetres(id)));

/** How far along the axis a length lies, 0 at its smallest radius and 1 at its largest. */
export const axisShare = (axis: Axis, metres: number) => toLogFraction(metres, axis.min, axis.max);

/** Where the names' column ends, CSS px from the stage's left (narrower on a narrow stage, whose names are set smaller). */
export const namesEnd = (stage: Pick<Stage, "width">) =>
  stage.width < OVERVIEW_NARROW_PX ? OVERVIEW_NAMES_NARROW_PX : OVERVIEW_NAMES_PX;

/** Where the axis starts, CSS px from the stage's left: just past the names' column. */
export const axisLeft = (stage: Pick<Stage, "width">) => namesEnd(stage) + OVERVIEW_AXIS_INSET_PX;

/** A share of the axis on the stage, CSS px from the left. */
export const axisX = (stage: Pick<Stage, "width">, share: number) =>
  axisLeft(stage) + share * (stage.width - axisLeft(stage) - OVERVIEW_MARGIN_PX);

/**
 * The overview's baseline, CSS px from the stage's top: as low as the dock lets it, `foot` the
 * height of the stage's foot the dock covers, leaving room beneath for the axis's values and
 * title (never above the top row's clearance).
 */
export const overviewBaseline = (stage: Stage, foot: number) =>
  Math.max(OVERVIEW_TOP_PX, stage.height - foot - OVERVIEW_FOOT_PX);

/** A row's height over `baseline`, CSS px: the stage between the toolbar and the baseline, shared. */
const rowOf = (ladder: Ladder, baseline: number) =>
  Math.max(0, baseline - OVERVIEW_TOP_PX) / ladder.sizes.length;

/** The body whose row a stage point's height falls in, if any: a whole row answers a pointer. */
export function overviewRowAt(ladder: Ladder, baseline: number, y: number) {
  const index = Math.floor((baseline - y) / rowOf(ladder, baseline));
  return index >= 0 && index < ladder.sizes.length ? index : null;
}

/** One body as the overview shows it above `baseline` (`overviewBaseline`), written into `out`. */
export function placeOverview(
  ladder: Ladder,
  axis: Axis,
  stage: Stage,
  baseline: number,
  index: number,
  out: Placed = blankPlaced(),
): Placed {
  const size = ladder.sizes[index]!;
  const share = axisShare(axis, size.radius);
  const row = rowOf(ladder, baseline);
  const radius = Math.max(
    MIN_DISC_PX,
    Math.min(OVERVIEW_ROW_FILL * row, lerp(OVERVIEW_DOT_PX[0], OVERVIEW_DOT_PX[1], share)),
  );
  out.index = index;
  out.x = axisX(stage, share);
  out.y = baseline - (index + 0.5) * row;
  out.radius = radius;
  out.polar = (radius * size.polar) / size.radius;
  out.low = radius;
  out.high = radius;
  return out;
}

/**
 * A body `k` of the way (0–1) from one place to another, written into `out` (which may be
 * `from`): radii ease in log, as the ladder's zoom does; places linearly. At 0 it is exactly
 * where it was, so a glide never jumps as it starts.
 */
export function glidePlaced(from: Placed, to: Placed, k: number, out: Placed = blankPlaced()) {
  /* Everything read from `from` first: `out` may be `from` itself. */
  const radius = Math.exp(lerp(Math.log(from.radius), Math.log(to.radius), k));
  const shape0 = from.polar / from.radius;
  const low0 = (from.low / from.radius) * radius;
  const high0 = (from.high / from.radius) * radius;
  out.index = from.index;
  out.x = lerp(from.x, to.x, k);
  out.y = lerp(from.y, to.y, k);
  out.radius = radius;
  out.polar = radius * lerp(shape0, to.polar / to.radius, k);
  out.low = lerp(low0, to.low, k);
  out.high = lerp(high0, to.high, k);
  return out;
}

const held = blankPlaced();

/**
 * A body on its way between the ladder (`k` 0) and the overview (1), written into `out`. A body
 * the ladder holds far off the stage starts from just past its edge, and one larger than the
 * stage from the stage's height, so it slides and shrinks into view rather than streaking in
 * from a size no screen shows (the full surfaces have handed over to dots by the time it shows).
 */
export function blendPlaced(
  from: Placed,
  to: Placed,
  k: number,
  stage: Stage,
  out: Placed = blankPlaced(),
): Placed {
  const radius = clamp(from.radius, MIN_DISC_PX, stage.height);
  const shrink = radius / from.radius;
  held.index = from.index;
  held.radius = radius;
  held.polar = from.polar * shrink;
  /* Held to the stage, the body still stands on the line it stood on. */
  held.y = from.y + from.polar - held.polar;
  held.x = clamp(from.x, -radius, stage.width + radius);
  held.low = from.low * shrink;
  held.high = from.high * shrink;
  return glidePlaced(held, to, k, out);
}

/** How far the glide into the overview (1) or back to the ladder (0) has come after `dt` more seconds. */
export const stepOverview = (level: number, on: boolean, dt: number, reduce: boolean) =>
  stepToward(level, on, dt, OVERVIEW_SECONDS, reduce);

/** A level from 0 to 1 moved `dt` more seconds towards 1 (`on`) or 0, over `seconds` all the way. */
export function stepToward(
  level: number,
  on: boolean,
  dt: number,
  seconds: number,
  reduce: boolean,
) {
  const goal = on ? 1 : 0;
  if (reduce) return goal;
  const step = dt / seconds;
  return on ? Math.min(goal, level + step) : Math.max(goal, level - step);
}

/**
 * The overview at a level of its glide: how far each body has gone from its place on the ladder
 * to its dot (`blend`, eased at both ends), and the dots' share of the light (`dots`), which
 * takes over from the full surfaces early on the way out and gives back late on the way in.
 */
export function overviewAt(level: number) {
  return { blend: smootherstep(level), dots: smoothstep(0, OVERVIEW_SWAP, level) };
}

/** A scale line: its share of the axis, and the round radius it marks in its unit. */
export type ScaleLine = { share: number; value: number; unit: RulerUnit };

/**
 * The overview's scale lines, left to right: every power of ten of the ruler's units on the
 * axis, each in the unit the ruler reads that length in (on auto: km, then the Sun's radius,
 * then the astronomical unit), so the lines read as the ruler does.
 */
export function scaleLines(ruler: Ruler, axis: Axis): ScaleLine[] {
  const lines: ScaleLine[] = [];
  for (const unit of rulerUnits(ruler)) {
    const base = Math.log10(METRES[unit]);
    const top = Math.log10(axis.max);
    for (let power = Math.ceil(Math.log10(axis.min) - base); power + base <= top; power++) {
      const metres = 10 ** (power + base);
      if (unitFor(ruler, metres) === unit)
        lines.push({ share: axisShare(axis, metres), value: 10 ** power, unit });
    }
  }
  return lines.sort((a, b) => a.share - b.share);
}
