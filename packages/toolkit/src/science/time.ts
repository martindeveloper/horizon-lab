/**
 * Astronomical time scales. Dates are UTC; `julianDay` ignores the ~69 s
 * TT − UTC offset, `julianEphemerisDay` adds it for series in TT.
 */

/** Julian Date of the J2000.0 epoch, 2000 January 1, 12:00 TT. */
export const J2000_JD = 2_451_545.0;

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
