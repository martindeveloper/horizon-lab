/**
 * Earth's calendar as the clocks run: a JavaScript date reaches about 273,000 years either
 * way, so the moment the solar system is drawn at (and the dates the cards print) is held at
 * that reach. Beyond it the elapsed time is all that can be said; the planets stand still.
 */
import { clamp } from "@horizon/toolkit/math";
import { JULIAN_YEAR_SECONDS } from "@horizon/toolkit/science";

/** The calendar's reach either way, years. */
const DATE_REACH_YEARS = 250_000;
const DATE_REACH_S = DATE_REACH_YEARS * JULIAN_YEAR_SECONDS;

/** Whether `seconds` after the epoch still has a date. */
export const withinCalendar = (seconds: number) => Math.abs(seconds) <= DATE_REACH_S;

/** The date `seconds` after the epoch, held at the reach, written into `out`. */
export function dateAt(epochMs: number, seconds: number, out = new Date()) {
  out.setTime(epochMs + clamp(seconds, -DATE_REACH_S, DATE_REACH_S) * 1000);
  return out;
}
