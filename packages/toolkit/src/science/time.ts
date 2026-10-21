/**
 * Astronomical time scales. Dates are UTC; `julianDay` ignores the ~69 s
 * TT − UTC offset, `julianEphemerisDay` adds it for series in TT.
 */
import { JULIAN_YEAR_SECONDS } from "./constants";

/** Julian Date of the J2000.0 epoch, 2000 January 1, 12:00 TT. */
export const J2000_JD = 2_451_545.0;

/** The J2000.0 epoch as a JavaScript time, ms (read as UTC, as `julianDay` reads dates). */
export const J2000_MS = Date.UTC(2000, 0, 1, 12);

const JULIAN_YEAR_MS = JULIAN_YEAR_SECONDS * 1000;

/** The Julian epoch of an instant (2000.0 plus Julian years since J2000), e.g. 2026.8. */
export const julianEpoch = (date: Date | number) => 2000 + (+date - J2000_MS) / JULIAN_YEAR_MS;

/** The instant (ms) of a Julian epoch: the inverse of `julianEpoch`. */
export const julianEpochMs = (epoch: number) => J2000_MS + (epoch - 2000) * JULIAN_YEAR_MS;

/** Days in a Julian century, the time unit of IAU and Meeus series. */
export const JULIAN_CENTURY_DAYS = 36_525;

/**
 * TT − UTC in seconds, rounded: 32.184 s + 37 leap seconds since 2017. ΔT
 * (TT − UT1) differs from it by under 0.9 s.
 */
export const DELTA_T_SECONDS = 69;

/** Julian Date of a calendar instant: days since −4712 January 1, 12:00. */
export function julianDay(date: Date) {
  return date.getTime() / 86_400_000 + 2_440_587.5;
}

/** Julian Ephemeris Day (TT) of a UTC instant, using `DELTA_T_SECONDS`. */
export function julianEphemerisDay(date: Date) {
  return (date.getTime() + DELTA_T_SECONDS * 1000) / 86_400_000 + 2_440_587.5;
}
