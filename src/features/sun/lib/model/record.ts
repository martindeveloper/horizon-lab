/**
 * The cycle's record, as data: the measured yearly sunspot numbers (SILSO, 1700 on) and group
 * numbers (Svalgaard & Schatten, 1610 on) on one axis, the groups scaled by the two records'
 * ratio over the years both cover; and the model's butterfly diagram, where its regions emerge
 * by phase and latitude, by the rule the globe throws them with.
 */
import { emergenceDensity } from "@/space/sun/model/activity";
import {
  DALTON_MINIMUM,
  GROUP_NUMBERS,
  MAUNDER_MINIMUM,
  SUNSPOT_NUMBERS,
  cycleCountOfYear,
  cyclePhaseOf,
  type YearlyCount,
} from "@/space/sun/model/cycle";
import { SPORER_SPREAD_RAD, SPORER_START_RAD } from "@/space/sun/model/parameters";

/** The first year either record covers and the last the sunspot record does. */
export const RECORD_FIRST_YEAR = GROUP_NUMBERS[0]!.year;
export const RECORD_LAST_YEAR = SUNSPOT_NUMBERS.at(-1)!.year;

/** Sunspot number per group: the ratio of the two records' sums over the years both cover. */
export const SUNSPOTS_PER_GROUP = (() => {
  let sunspots = 0;
  let groups = 0;
  for (const { year, number } of GROUP_NUMBERS) {
    const spots = SUNSPOT_NUMBERS[year - SUNSPOT_NUMBERS[0]!.year];
    if (!spots) continue;
    sunspots += spots.number;
    groups += number;
  }
  return sunspots / groups;
})();

/** The group record on the sunspot number's axis. */
export const SCALED_GROUPS: readonly YearlyCount[] = GROUP_NUMBERS.map(({ year, number }) => ({
  year,
  number: number * SUNSPOTS_PER_GROUP,
}));

/** The highest yearly value either line reaches. */
export const RECORD_PEAK = Math.max(
  ...SUNSPOT_NUMBERS.map(({ number }) => number),
  ...SCALED_GROUPS.map(({ number }) => number),
);

/** The record's named lulls, calendar years. */
export const RECORD_LULLS = [
  { id: "maunder", span: MAUNDER_MINIMUM },
  { id: "dalton", span: DALTON_MINIMUM },
] as const;

/** How far from the equator the butterfly reaches: two spreads past the cycle's starting latitude. */
export const BUTTERFLY_REACH_RAD = SPORER_START_RAD + 2 * SPORER_SPREAD_RAD;

/**
 * The butterfly on a grid: `columns` times from `fromYear` to `toYear` by `rows` latitudes from
 * +reach down to −reach, cell centres, each the emergence density over the grid's peak (0–1),
 * row-major from the north.
 */
export function butterflyGrid(fromYear: number, toYear: number, columns: number, rows: number) {
  const grid = new Float32Array(columns * rows);
  let peak = 0;
  for (let c = 0; c < columns; c++) {
    const phase = cyclePhaseOf(
      cycleCountOfYear(fromYear + ((c + 0.5) / columns) * (toYear - fromYear)),
    );
    for (let r = 0; r < rows; r++) {
      const latitude = BUTTERFLY_REACH_RAD * (1 - (2 * (r + 0.5)) / rows);
      const density = emergenceDensity(phase, latitude);
      grid[r * columns + c] = density;
      peak = Math.max(peak, density);
    }
  }
  if (peak > 0) for (let i = 0; i < grid.length; i++) grid[i]! /= peak;
  return grid;
}
