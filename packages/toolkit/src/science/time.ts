/** Astronomical time scales. Dates are UTC; the ~69 s TT − UTC offset is ignored. */

/** Julian Date of the J2000.0 epoch, 2000 January 1, 12:00 TT. */
export const J2000_JD = 2_451_545.0;

/** Julian Date of a calendar instant: days since −4712 January 1, 12:00. */
export function julianDay(date: Date) {
  return date.getTime() / 86_400_000 + 2_440_587.5;
}
