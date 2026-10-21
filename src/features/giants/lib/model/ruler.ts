/**
 * The ruler's length: a round number of the chosen unit about a hundred CSS pixels long at
 * the camera's scale. `auto` picks kilometres for the small, the Sun's radius for stars and
 * the astronomical unit for the giants and the horizons past them.
 */
import { FIGURES } from "@horizon/toolkit/bodies";
import { SPEED_OF_LIGHT, convert } from "@horizon/toolkit/science";

/** The ruler's unit: chosen by size, or held. */
export const RULERS = ["auto", "km", "earth", "sun", "au", "light"] as const;
export type Ruler = (typeof RULERS)[number];

/** The units a ruler can read in, in metres. */
const METRES = {
  km: 1e3,
  earth: FIGURES.earth.equatorialKm * 1e3,
  sun: convert(1, "Rsun", "m"),
  au: convert(1, "au", "m"),
  ls: SPEED_OF_LIGHT,
  lmin: convert(1, "min", "s") * SPEED_OF_LIGHT,
  lh: convert(1, "h", "s") * SPEED_OF_LIGHT,
} as const;
export type RulerUnit = keyof typeof METRES;

/** The bar's length aimed at, CSS pixels. */
const AIM_PX = 96;

function unitFor(ruler: Ruler, metres: number): RulerUnit {
  if (ruler === "light") return metres < METRES.lmin ? "ls" : metres < METRES.lh ? "lmin" : "lh";
  if (ruler !== "auto") return ruler;
  if (metres < 2e8) return "km";
  if (metres < 0.2 * METRES.au) return "sun";
  return "au";
}

/** 1, 2 or 5 times a power of ten, at most `x`. */
function round125(x: number) {
  const power = 10 ** Math.floor(Math.log10(x));
  const lead = x / power;
  return (lead >= 5 ? 5 : lead >= 2 ? 2 : 1) * power;
}

/** The bar for a scale in metres per CSS pixel: its length in its unit, and in pixels. */
export function rulerFor(ruler: Ruler, scale: number) {
  if (!(scale > 0)) return null;
  const aim = scale * AIM_PX;
  const unit = unitFor(ruler, aim);
  const value = round125(aim / METRES[unit]);
  return { unit, value, px: (value * METRES[unit]) / scale };
}
