/**
 * Catalogue figures as the guide's equation lines print them, in English like the rest of each
 * line: "8.277 kpc", "4.297 × 10⁶ M☉", "32.7 ± 0.8 M☉", "4.1–6.6 × 10¹⁰ M☉".
 */
import type { Value } from "@/lib/facts";
import { UNITS, formatSignificant, isUnitId, powerOfTen } from "@horizon/toolkit/science";

/** From here a figure prints as a mantissa and a power of ten, as the lines always have. */
const SCIENTIFIC_FROM = 1e5;
/** Significant figures of a span's ends, and of a figure that names none. */
const SPAN_DIGITS = 2;
const DEFAULT_DIGITS = 3;

const symbolOf = (unit: Value["unit"]) => (isUnitId(unit) ? UNITS[unit].symbol : unit);

const exponentOf = (value: number) => Math.floor(Math.log10(Math.abs(value)));

function number(value: number, digits: number) {
  if (Math.abs(value) < SCIENTIFIC_FROM) return formatSignificant(value, "en", digits);
  const exponent = exponentOf(value);
  return `${(value / 10 ** exponent).toFixed(digits - 1)} × ${powerOfTen(exponent)}`;
}

/** The figure and its unit. */
export const quote = (fact: Value) =>
  `${number(fact.value, fact.digits ?? DEFAULT_DIGITS)} ${symbolOf(fact.unit)}`;

/** The figure with half its published span as the error, at the figure's own decimals; the figure alone without one. */
export function quoteError(fact: Value) {
  if (!fact.range) return quote(fact);
  const text = number(fact.value, fact.digits ?? DEFAULT_DIGITS);
  const decimals = text.split(".")[1]?.length ?? 0;
  const error = (fact.range[1] - fact.range[0]) / 2;
  return `${text} ± ${error.toFixed(decimals)} ${symbolOf(fact.unit)}`;
}

/** The published span, one power of ten for both ends; the figure alone without one. */
export function quoteSpan(fact: Value) {
  if (!fact.range) return quote(fact);
  const [low, high] = fact.range;
  const scientific = Math.abs(high) >= SCIENTIFIC_FROM;
  const exponent = exponentOf(high);
  const end = (value: number) =>
    scientific
      ? (value / 10 ** exponent).toFixed(SPAN_DIGITS - 1)
      : formatSignificant(value, "en", SPAN_DIGITS);
  const span = `${end(low)}–${end(high)}`;
  return `${scientific ? `${span} × ${powerOfTen(exponent)}` : span} ${symbolOf(fact.unit)}`;
}
