import { AU_KM, LIGHT_YEAR_KM, JULIAN_YEAR_SECONDS } from "./constants";

export type Quantity = { value: number; unit: string; digits: number };
export type Magnitude = {
  value: number;
  digits: number;
  scale: "thousand" | "million" | "billion" | null;
};
function finite(value: number) {
  if (!Number.isFinite(value)) throw new RangeError("Quantity must be finite");
}
/** Choose a display scale; locale-aware rendering belongs to the application. */
export function scaleMagnitude(value: number): Magnitude {
  finite(value);
  for (const [divisor, scale] of [
    [1e9, "billion"],
    [1e6, "million"],
    [1e3, "thousand"],
  ] as const) {
    if (Math.abs(value) >= divisor)
      return { value: value / divisor, digits: divisor === 1e3 ? 1 : 2, scale };
  }
  return { value, digits: 0, scale: null };
}
export function lengthQuantity(km: number): Quantity {
  finite(km);
  if (Math.abs(km) >= LIGHT_YEAR_KM) return { value: km / LIGHT_YEAR_KM, unit: "ly", digits: 2 };
  if (Math.abs(km) >= AU_KM) return { value: km / AU_KM, unit: "au", digits: 2 };
  return { value: km, unit: "km", digits: 0 };
}
export function durationQuantity(seconds: number): Quantity {
  finite(seconds);
  for (const [max, divisor, unit, digits] of [
    [1e-6, 1e-9, "ns", 1],
    [1e-3, 1e-6, "μs", 1],
    [1, 1e-3, "ms", 1],
    [60, 1, "s", 2],
    [3600, 60, "min", 1],
    [86400, 3600, "h", 1],
    [JULIAN_YEAR_SECONDS, 86400, "days", 1],
    [Infinity, JULIAN_YEAR_SECONDS, "years", 1],
  ] as const) {
    if (Math.abs(seconds) < max) return { value: seconds / divisor, unit, digits };
  }
  throw new RangeError("Quantity is out of range");
}
