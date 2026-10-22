/**
 * Catalogue figures as the lab prints them with their unit: "8.277 kpc", "4.297 × 10⁶ M☉",
 * "32.7 ± 0.8 M☉", "4.1–6.6 × 10¹⁰ M☉". The guide's equation lines are English throughout; the
 * atlas passes the page's language.
 */
import type { Value } from "@/lib/facts";
import {
  UNITS,
  formatSignificant,
  isUnitId,
  numberFormat,
  powerOfTen,
} from "@horizon/toolkit/science";

/** From here a figure prints as a mantissa and a power of ten, as the lines always have. */
const SCIENTIFIC_FROM = 1e5;
/** Significant figures of a span's ends, and of a figure that names none. */
const SPAN_DIGITS = 2;
const DEFAULT_DIGITS = 3;

const symbolOf = (unit: Value["unit"]) => (isUnitId(unit) ? UNITS[unit].symbol : unit);

const exponentOf = (value: number) => Math.floor(Math.log10(Math.abs(value)));

/** Decimals that keep `digits` significant figures of `value`. */
const decimalsOf = (value: number, digits: number) => Math.max(0, digits - 1 - exponentOf(value));

function number(value: number, digits: number, locale: string) {
  if (Math.abs(value) < SCIENTIFIC_FROM) return formatSignificant(value, locale, digits, true);
  const exponent = exponentOf(value);
  const mantissa = numberFormat(locale, digits - 1, true).format(value / 10 ** exponent);
  return `${mantissa} × ${powerOfTen(exponent)}`;
}

/** The figure and its unit. */
export const quote = (fact: Value, locale = "en") =>
  `${number(fact.value, fact.digits ?? DEFAULT_DIGITS, locale)} ${symbolOf(fact.unit)}`;

/** The figure with half its published span as the error, at the figure's own decimals; the figure alone without one. */
export function quoteError(fact: Value, locale = "en") {
  if (!fact.range) return quote(fact, locale);
  const digits = fact.digits ?? DEFAULT_DIGITS;
  const error = (fact.range[1] - fact.range[0]) / 2;
  const decimals = decimalsOf(fact.value, digits);
  const text = `${number(fact.value, digits, locale)} ± ${numberFormat(locale, decimals, true).format(error)}`;
  return `${text} ${symbolOf(fact.unit)}`;
}

/** The published span, one power of ten for both ends; the figure alone without one. */
export function quoteSpan(fact: Value, locale = "en") {
  if (!fact.range) return quote(fact, locale);
  const [low, high] = fact.range;
  const scientific = Math.abs(high) >= SCIENTIFIC_FROM;
  const exponent = exponentOf(high);
  const end = (value: number) =>
    scientific
      ? numberFormat(locale, SPAN_DIGITS - 1, true).format(value / 10 ** exponent)
      : formatSignificant(value, locale, SPAN_DIGITS);
  const span = `${end(low)}–${end(high)}`;
  return `${scientific ? `${span} × ${powerOfTen(exponent)}` : span} ${symbolOf(fact.unit)}`;
}

/** A spin with its asymmetric published span: "0.84 (+0.08 / −0.16)"; the figure alone without one. */
export function quoteSpin(fact: Value, locale = "en") {
  const digits = fact.digits ?? DEFAULT_DIGITS;
  const text = number(fact.value, digits, locale);
  if (!fact.range) return text;
  const decimals = decimalsOf(fact.value, digits);
  const format = (v: number) => numberFormat(locale, decimals, true).format(v);
  return `${text} (+${format(fact.range[1] - fact.value)} / −${format(fact.value - fact.range[0])})`;
}
