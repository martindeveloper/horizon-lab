import { formatDistance, formatDistanceRange, type DistanceFormat } from "./distance";
import { formatSignificant, joinSpan } from "./format";
import { convert, type UnitId } from "./units";

/**
 * Catalogued figures: every number a card prints, once, with a unit of the kit, a source and
 * how it was checked. `S` is the caller's source id, usually the keys of its bibliography.
 */

/** A unit of the kit (`UNITS`), so a figure converts with `convert`; or a plain number. */
export type Unit = UnitId | "count" | "percent" | "ratio";
/** Lengths a card shows in the visitor's distance unit (au, ly or pc) with its symbol. */
export type LengthUnit = "au" | "ly" | "Mly" | "pc" | "kpc" | "Mpc" | "Gpc";

const LENGTHS: ReadonlySet<Unit> = new Set<LengthUnit>([
  "au",
  "ly",
  "Mly",
  "pc",
  "kpc",
  "Mpc",
  "Gpc",
]);
export const isLength = (unit: Unit): unit is LengthUnit => LENGTHS.has(unit);

const PLAIN: ReadonlySet<Unit> = new Set<Unit>(["count", "percent", "ratio"]);
/** Whether a figure's unit is one of the kit's, so it converts; a plain number's is not. */
export const isUnitId = (unit: Unit): unit is UnitId => !PLAIN.has(unit);

/** A figure's number in another unit of its dimension; a plain number has none to convert to. */
export function convertFigure(value: number, unit: Unit, to: UnitId) {
  if (!isUnitId(unit)) throw new TypeError(`A plain ${unit} has no ${to}`);
  return convert(value, unit, to);
}

/**
 * How a figure was checked: opened in the source, computed from checked inputs, a deliberate
 * model choice, or not yet confirmed. Every fact states it.
 */
export type Status = "verified" | "derived" | "teaching-choice" | "flag";

export type Range = readonly [low: number, high: number];

export type FactBase<S extends string = string> = {
  unit: Unit;
  source: S;
  status: Status;
  /** Significant figures to print; by default as many as the value (or range) is written with. */
  digits?: number;
  /**
   * Print in this unit of the kit, the one the message words: years as "Gyr" for "billion
   * years". Lengths ignore it and follow the visitor's distance unit.
   */
  show?: UnitId;
  /** Arithmetic or caveat for the ledger. */
  note?: string;
};

/** A measured or modelled value, with an optional published spread. */
export type FactValue<S extends string = string> = FactBase<S> & { value: number; range?: Range };
/** Only a published span ("2,000–5,000 au"): no central value is claimed. */
export type FactSpan<S extends string = string> = FactBase<S> & { range: Range; value?: never };

/** Significant figures a literal is written with: 1,500 → 2, 4.57 → 3, 100 → 1. */
function significantOf(...values: number[]) {
  return Math.max(
    ...values.map((v) =>
      v === 0
        ? 1
        : Math.abs(v).toExponential().split("e")[0]!.replace(".", "").replace(/0+$/, "").length,
    ),
  );
}

/** A plain figure in the unit the message words (`show`), as a number. */
function shown(fact: FactBase, v: number) {
  const { unit, show } = fact;
  return show && unit !== "count" && unit !== "percent" && unit !== "ratio"
    ? convert(v, unit, show)
    : v;
}

/**
 * Plain numbers in words a reader takes in: "6.5 billion", "4 million"; scientific from
 * 10¹² ("5 × 10¹⁶"). An exact value whose every digit counts stays whole.
 */
function plain(format: DistanceFormat, values: number[], digits: number, fixed: boolean) {
  const top = Math.max(...values.map(Math.abs));
  const whole = top > 0 && digits > Math.floor(Math.log10(top));
  const scale = whole || top < 1e6 || top >= 1e12 ? 1 : top >= 1e9 ? 1e9 : 1e6;
  const text = joinSpan(
    values.map((v) => formatSignificant(v / scale, format.locale, digits, fixed)),
  );
  if (scale === 1) return text;
  const word = scale === 1e9 ? format.billionWord : format.millionWord;
  return `${text} ${word ?? (scale === 1e9 ? "billion" : "million")}`;
}

/**
 * A figure in the reader's language: lengths in their distance unit with its symbol, other
 * units in the unit the message words. Literature values keep their significant figures;
 * lengths at least two, so a conversion keeps its shape. `live` values (a model's figure at
 * some moment) print at the readout's precision unless the fact fixes its digits.
 */
export function printFact(fact: FactBase, value: number, format: DistanceFormat, live = false) {
  const { unit, digits } = fact;
  if (isLength(unit)) {
    const au = convert(value, unit, "au");
    if (live && digits === undefined) return formatDistance(au, format);
    return formatDistance(au, {
      ...format,
      significant: digits ?? Math.max(2, significantOf(value)),
    });
  }
  return plain(format, [shown(fact, value)], digits ?? significantOf(value), digits !== undefined);
}

/** A published span, the unit once: "2.1–3.3 au", "1,300–2,000", "4–5" (billion years). */
export function printFactSpan(fact: FactBase & { range: Range }, format: DistanceFormat) {
  const [low, high] = fact.range;
  const { unit } = fact;
  if (isLength(unit))
    return formatDistanceRange(convert(low, unit, "au"), convert(high, unit, "au"), {
      ...format,
      significant: fact.digits ?? Math.max(2, significantOf(low, high)),
    });
  const ends = [shown(fact, low), shown(fact, high)];
  return plain(format, ends, fact.digits ?? significantOf(low, high), fact.digits !== undefined);
}

/**
 * A figure as prose quotes it: a number, or a span, in the unit the sentence names (`show`,
 * lengths included), with the significant figures it is written with.
 */
export function quoteFact(locale: string, fact: FactBase & { value?: number; range?: Range }) {
  const ends = fact.value !== undefined ? [fact.value] : fact.range ? [...fact.range] : [];
  const digits = fact.digits ?? significantOf(...ends);
  const fixed = fact.digits !== undefined;
  return joinSpan(ends.map((v) => formatSignificant(shown(fact, v), locale, digits, fixed)));
}
