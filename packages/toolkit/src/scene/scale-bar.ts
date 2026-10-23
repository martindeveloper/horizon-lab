/** A scale bar: a round length in the visitor's unit, and how many CSS pixels it spans. */
import {
  convertDistance,
  resolveDistanceUnit,
  type DistanceChoice,
  type DistanceUnit,
} from "../science";
import { worldPerPixel } from "./kit";

/** The nearest of 1, 2, 5 × 10ⁿ. */
export function niceNumber(x: number) {
  if (!(x > 0)) return 1;
  const exp = Math.floor(Math.log10(x));
  const f = x / 10 ** exp;
  let rounded = 10;
  if (f < 1.5) {
    rounded = 1;
  } else if (f < 3.5) {
    rounded = 2;
  } else if (f < 7.5) {
    rounded = 5;
  }
  return rounded * 10 ** exp;
}

/**
 * The bar for a perspective camera `dist` world units from its aim (`fov` in degrees). World
 * units are `world`; the bar is a round number of the visitor's unit (`choice`) between 44 and
 * 140 px long.
 */
export function scaleBar(options: {
  fov: number;
  dist: number;
  width: number;
  height: number;
  world: DistanceUnit;
  choice: DistanceChoice;
}) {
  const { fov, dist, width, height, world, choice } = options;
  const worldPerPx = worldPerPixel(fov, dist, Math.max(1, height));
  const span = worldPerPx * Math.min(150, width * 0.36);
  const unit = resolveDistanceUnit(choice, convertDistance(span, world, "au"));
  const perWorld = convertDistance(1, world, unit);
  const value = niceNumber(span * perWorld);
  const px = Math.round(Math.max(44, Math.min(140, width * 0.4, value / perWorld / worldPerPx)));
  return { value, unit, px };
}
