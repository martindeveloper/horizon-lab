/**
 * A span of years as the labs print it: the unit that fits, the number in it, and its plural
 * category for the word that agrees with it. Each lab words the sentence itself ("4.6 billion
 * years ago", "před 4,6 miliardy let"), since a language's case depends on the sentence; what
 * is shared is which unit a span reads in and how its number rounds.
 */
import { pluralOf } from "@horizon/toolkit/science";

import type { Format } from "./facts";

export type YearUnit = "years" | "thousand" | "million" | "billion";

const SCALE: Readonly<Record<YearUnit, number>> = {
  years: 1,
  thousand: 1e3,
  million: 1e6,
  billion: 1e9,
};
/** Where each unit takes over: up to ten thousand a span reads in years ("9,500 years"). */
const FROM: Readonly<Record<YearUnit, number>> = {
  years: 0,
  thousand: 1e4,
  million: 1e6,
  billion: 1e9,
};

/** A count of digits, for every unit or by the unit and the number in it. */
export type YearDigits = number | ((unit: YearUnit, inUnit: number) => number);

export type YearSpanOptions = {
  /** The units the lab has words for, smallest first; a span below the first still reads in it. */
  units?: readonly YearUnit[];
  /** Significant digits (2 by default). */
  digits?: YearDigits;
  /** Fixed decimals instead, always printed ("4.00 billion"), so a readout keeps its width. */
  decimals?: YearDigits;
  /** With significant digits, keep every one, trailing zeros too ("7.00"), for the same reason. */
  steady?: boolean;
};

const ALL: readonly YearUnit[] = ["years", "thousand", "million", "billion"];

/**
 * A span of `years` (its size; the sign is the sentence's) in the largest unit its printed
 * value reaches, so 999,700 reads "1.0 million", never "1,000 thousand".
 */
export function yearSpan(f: Format, years: number, locale: string, options: YearSpanOptions = {}) {
  const { units = ALL, digits = 2, decimals, steady = false } = options;
  const count = (given: YearDigits, unit: YearUnit, inUnit: number) =>
    typeof given === "number" ? given : given(unit, inUnit);
  /* The number in a unit as it will print, rounded the way it prints. */
  const rounded = (unit: YearUnit) => {
    const inUnit = Math.abs(years) / SCALE[unit];
    if (decimals !== undefined) {
      const step = 10 ** count(decimals, unit, inUnit);
      return Math.round(inUnit * step) / step;
    }
    return Number(inUnit.toPrecision(count(digits, unit, inUnit)));
  };
  let unit = units[0] ?? "years";
  for (const candidate of units) {
    if (rounded(candidate) * SCALE[candidate] >= FROM[candidate]) unit = candidate;
  }
  const inUnit = Math.abs(years) / SCALE[unit];
  const value =
    decimals === undefined
      ? f.number(inUnit, {
          maximumSignificantDigits: count(digits, unit, inUnit),
          ...(steady && { minimumSignificantDigits: count(digits, unit, inUnit) }),
        })
      : f.number(inUnit, {
          minimumFractionDigits: count(decimals, unit, inUnit),
          maximumFractionDigits: count(decimals, unit, inUnit),
        });
  return { unit, value, valuePlural: pluralOf(locale, value) };
}
