import type { Finding } from "./model";

/** A number with a fixed count of decimals, two by default. */
export const fixed = (value: number, digits = 2) => value.toFixed(digits);

/** How each finding level reads in a report. */
export const LEVEL: Record<Finding["level"], string> = {
  error: "Error",
  regression: "Regression",
  warning: "Warning",
  info: "Note",
};
