/**
 * The activity cycle: the sunspot record (`sunspots.json`: WDC-SILSO's yearly means since 1700
 * and the Svalgaard & Schatten 2016 group numbers since 1610, `scripts/fetch-sunspots.mjs`),
 * where a date falls in the 11-year cycle, the cycle's shape, and Wolf's relative number.
 *
 * A cycle count is a real number: its integer part numbers the cycle (25 from December 2019),
 * its fraction the phase, 0 at minimum. Odd and even cycles differ in polarity (Hale), so the
 * count, not the phase alone, says which way the field points.
 */
import {
  CYCLE_25_MINIMUM_YEAR,
  CYCLE_25_NUMBER,
  CYCLE_PERIOD_YR,
  CYCLE_RISE_YR,
  CYCLE_SHAPE_C,
} from "./parameters";
import DATA from "./sunspots.json";

export type YearlyCount = { year: number; number: number };

/** A cell of the record that must be a number. */
function count(value: unknown): number {
  if (typeof value !== "number")
    throw new TypeError(`sunspots.json: ${String(value)} is not a number`);
  return value;
}
const yearly = (rows: readonly (readonly unknown[])[]): YearlyCount[] =>
  rows.map((row) => ({ year: count(row[0]), number: count(row[1]) }));

/** Yearly mean total sunspot number, SILSO v2.0, 1700 onwards. */
export const SUNSPOT_NUMBERS: readonly YearlyCount[] = yearly(DATA.sunspots.rows);
/** Yearly sunspot group number, the Svalgaard & Schatten 2016 backbone, 1610 onwards. */
export const GROUP_NUMBERS: readonly YearlyCount[] = yearly(DATA.groups.rows);
/** Where the record comes from, for the ledger. */
export const SUNSPOT_SOURCE = { reference: DATA.reference, fetched: DATA.fetched, urls: DATA.urls };

/** The yearly mean sunspot number of a calendar year; undefined before the record or after it. */
export function sunspotNumberIn(year: number) {
  const first = SUNSPOT_NUMBERS[0]!.year;
  return SUNSPOT_NUMBERS[Math.floor(year) - first]?.number;
}
/** The yearly group number of a calendar year; undefined outside the record. */
export function groupNumberIn(year: number) {
  const first = GROUP_NUMBERS[0]!.year;
  return GROUP_NUMBERS[Math.floor(year) - first]?.number;
}

/** Named stretches of the record, calendar years. */
export const MAUNDER_MINIMUM = [1645, 1715] as const; // Eddy 1976
export const DALTON_MINIMUM = [1790, 1830] as const; // Hathaway 2015, §4.4
export const MODERN_MAXIMUM = [1940, 2000] as const; // Hathaway 2015, §4.4 (cycles 17–23)
/** Schwabe announced the cycle in 1843 (published 1844); Wolf defined the relative number in 1848 (published 1852). */
export const SCHWABE_YEAR = 1843;
export const WOLF_YEAR = 1848;

/** A JavaScript time or Date as a decimal calendar year. */
export function decimalYear(date: Date | number) {
  const d = typeof date === "number" ? new Date(date) : date;
  const year = d.getUTCFullYear();
  const start = Date.UTC(year, 0, 1);
  const next = Date.UTC(year + 1, 0, 1);
  return year + (d.getTime() - start) / (next - start);
}

/** The cycle count at a date: cycle number plus phase, counted from cycle 25's minimum at the mean period. */
export function cycleCountAt(date: Date | number) {
  return CYCLE_25_NUMBER + (decimalYear(date) - CYCLE_25_MINIMUM_YEAR) / CYCLE_PERIOD_YR;
}
/** The decimal year at a cycle count: the inverse of `cycleCountAt`. */
export function yearOfCycleCount(count: number) {
  return CYCLE_25_MINIMUM_YEAR + (count - CYCLE_25_NUMBER) * CYCLE_PERIOD_YR;
}
/** The phase alone, 0–1, 0 at minimum. */
export const cyclePhaseOf = (count: number) => count - Math.floor(count);
/** The cycle's phase at a date, 0–1. */
export const cyclePhaseAt = (date: Date | number) => cyclePhaseOf(cycleCountAt(date));
/** Which cycle a count is in (its number). */
export const cycleNumberOf = (count: number) => Math.floor(count);

/*
 * Hathaway's cycle curve F(t) ∝ (t/b)³ / (exp((t/b)²) − c): b is set so the peak comes
 * CYCLE_RISE_YR after minimum, and the curve is scaled to peak at 1.
 */
const shape = (u: number) => (u <= 0 ? 0 : u ** 3 / (Math.exp(u * u) - CYCLE_SHAPE_C));
const PEAK_U = (() => {
  let best = 0;
  let bestValue = 0;
  for (let u = 0.01; u < 4; u += 0.001) {
    const value = shape(u);
    if (value > bestValue) {
      bestValue = value;
      best = u;
    }
  }
  return best;
})();
const SHAPE_B = CYCLE_RISE_YR / CYCLE_PERIOD_YR / PEAK_U;
const SHAPE_PEAK = shape(PEAK_U);

/** One cycle's activity at a phase (years since its minimum over the period), 0–1, peaking at 1. */
export const cycleShape = (phase: number) => shape(phase / SHAPE_B) / SHAPE_PEAK;

/**
 * Activity at a point in the cycle, 0 to about 1: this cycle's curve plus the tail of the one
 * before it, which still runs at a minimum (cycles overlap by a year or two).
 */
export const activityAt = (phase: number) => cycleShape(phase) + cycleShape(phase + 1);

/** Wolf's relative sunspot number, R = k (10 g + s): groups count ten, spots one, k the observer's factor. */
export const wolfNumber = (groups: number, spots: number, k = 1) => k * (10 * groups + spots);
