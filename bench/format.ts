import type { Finding } from "./model";

export const fixed = (value: number, digits = 2) => value.toFixed(digits);

export const LEVEL: Record<Finding["level"], string> = {
  error: "Error",
  regression: "Regression",
  warning: "Warning",
  info: "Note",
};
