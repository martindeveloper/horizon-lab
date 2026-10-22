import { convert } from "@horizon/toolkit/science";

/**
 * The clock: how much of the Sun's time passes in one second of the visitor's. Granules live
 * ten minutes, a flare an hour, a spot group weeks, the cycle eleven years, so each view has
 * its own natural pace and the dock lets the visitor pick another.
 */
export const CLOCK_RATES = ["real", "minute", "hour", "day", "month", "year"] as const;

export type ClockRate = (typeof CLOCK_RATES)[number];

/** Model seconds per displayed second at each rate. */
export const SECONDS_PER_SECOND: Readonly<Record<ClockRate, number>> = {
  real: 1,
  minute: convert(1, "min", "s"),
  hour: convert(1, "h", "s"),
  day: convert(1, "d", "s"),
  /* A twelfth of a year: the eleven-year cycle in a little over two minutes. */
  month: convert(1, "yr", "s") / 12,
  year: convert(1, "yr", "s"),
};
