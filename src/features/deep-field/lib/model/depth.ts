/**
 * Depth: the one axis Deep Field moves along. The ladder places every view on a log scale of
 * camera distance; the eyepiece reads how far a place is and how long its light has been on
 * the way, which is the same thing said twice: looking farther is looking back.
 */
import { SUN_BIRTH } from "@/space/solar-system/model/parameters";
import { clamp01 } from "@horizon/toolkit/math";
import {
  LIGHT_YEAR_AU,
  PLANCK_2018,
  convert,
  lookbackTimeGyr,
  redshiftAtComovingDistance,
} from "@horizon/toolkit/science";

import { CMB_AGE_YEARS, CMB_MLY, LAST_SCATTERING_Z, UNIVERSE_AGE_GYR } from "./cosmos";
import type { ViewId } from "./view-ids";
import { VIEWS } from "./views";

/** The ladder's ends, camera distance in ly: inside Mercury's orbit to past the CMB. */
export const LADDER_LY = { near: 0.35 / LIGHT_YEAR_AU, far: 3e11 } as const;

const span = Math.log(LADDER_LY.far / LADDER_LY.near);
/** 0 at the near end of the ladder, 1 at the far end, for a camera distance in ly. */
export const depthOf = (ly: number) => clamp01(Math.log(ly / LADDER_LY.near) / span);
/** The camera distance (ly) at a depth 0..1. */
export const lyAtDepth = (depth: number) => LADDER_LY.near * Math.exp(clamp01(depth) * span);

/** The ladder's rungs, near to far: each view at its depth. */
export const RUNGS: readonly { id: ViewId; depth: number }[] = VIEWS.map((v) => ({
  id: v.id,
  depth: depthOf(v.ly),
}));

/** Below this, light's travel time is its distance in years to better than a part in 10⁴. */
const NEARBY_LY = 1e6;
/** The microwave background's distance today, ly: nothing farther can be seen. */
export const CMB_LY = CMB_MLY * 1e6;

export type Sightline = {
  /** Today's distance, ly (capped at the microwave background). */
  ly: number;
  /** How long ago the light we see from there set out, years. */
  years: number;
  /** Its redshift; 0 nearby. */
  z: number;
};

/**
 * How far a place is and when the light we see from it left. Nearby that is its distance in
 * years; farther, flat ΛCDM: the redshift at that comoving distance and its lookback time.
 */
export function sightline(ly: number): Sightline {
  if (ly >= CMB_LY)
    return {
      ly: CMB_LY,
      years: UNIVERSE_AGE_GYR * 1e9 - CMB_AGE_YEARS,
      z: LAST_SCATTERING_Z,
    };
  if (ly < NEARBY_LY) return { ly, years: ly, z: 0 };
  const z = redshiftAtComovingDistance(convert(ly, "ly", "Mpc"), PLANCK_2018);
  return { ly, years: lookbackTimeGyr(z, PLANCK_2018) * 1e9, z };
}

/**
 * Earth when the light set out, oldest band first reached: each band starts at its lookback
 * (years) and holds until the next. Rounded from the geologic time scale and the human record;
 * docs/science-sources.md cites each.
 */
export const EARTH_THEN = [
  { id: "iceAge", from: 11_700 },
  { id: "firstHumans", from: 115_000 },
  { id: "stoneTools", from: 300_000 },
  { id: "upright", from: 3.3e6 },
  { id: "mammals", from: 7e6 },
  { id: "dinosaurs", from: 66e6 },
  { id: "land", from: 233e6 },
  { id: "seas", from: 470e6 },
  { id: "simple", from: 538.8e6 },
  { id: "microbes", from: 2.4e9 },
  { id: "young", from: 3.5e9 },
  { id: "noEarth", from: 4.54e9 },
  { id: "noSun", from: SUN_BIRTH },
] as const;

export type EraId = (typeof EARTH_THEN)[number]["id"];

/**
 * When the light we see set out, as a reader would place it: a clock time the same day, a
 * date within the year, a calendar year (astronomical: 0 is 1 BC) since the last ice age, then
 * what Earth was like. The microwave background is the Universe's own first light.
 */
export type Then =
  | { kind: "clock" | "date"; at: Date }
  | { kind: "year"; year: number }
  | { kind: "era"; id: EraId }
  | { kind: "cmb" };

const YEAR_MS = 365.25 * 86_400_000;

export function thenOf(line: Sightline, now: Date): Then {
  if (line.ly >= CMB_LY) return { kind: "cmb" };
  const era = EARTH_THEN.filter((band) => line.years >= band.from).at(-1);
  if (era) return { kind: "era", id: era.id };
  const at = new Date(now.getTime() - line.years * YEAR_MS);
  if (line.years >= 1) return { kind: "year", year: at.getFullYear() };
  return { kind: at.toDateString() === now.toDateString() ? "clock" : "date", at };
}
