/**
 * A catalogued figure as one sentence prints it, in one place: the unit it is read in, its
 * significant figures, a power of ten its sentence words ("4.3 million"), its style (a plain
 * number or span, scientific notation, value ± error, asymmetric bounds) and whether its unit
 * follows. Every quote returns the text and the plural category of the number as printed, for
 * the word after it ("10,8 miliardy" is many in Czech, "18 miliard" other).
 */
import { type FactBase, type Range, type Unit, isUnitId, shown, significantOf } from "./facts";
import { formatSignificant, joinSpan, numberFormat, powerOfTen } from "./format";
import { UNITS, convert, type UnitId } from "./units";

export type FigureStyle =
  /** A plain number, or a span. */
  | "plain"
  /** A mantissa and a power of ten from `SCIENTIFIC_FROM`, one power for a span's two ends. */
  | "scientific"
  /** The value ± half its span, at the value's own decimals. */
  | "error"
  /** The value with its span's distances above and below it: "0.84 (+0.08 / −0.16)". */
  | "bounds";

export type FigureOptions = {
  /** Read in this unit of the kit; by default the fact's `show`, else its own. */
  in?: UnitId;
  /** Significant figures; by default the fact's, else as many as it is written with. */
  digits?: number;
  /** Count in this power of ten, its word in the sentence: 6 for "million". */
  perPower?: number;
  /** Quote the published span even beside a value; without a value the span is quoted anyway. */
  span?: boolean;
  style?: FigureStyle;
  /** Follow the number with the unit's symbol. */
  withUnit?: boolean;
};

/** A fact as the formatter takes it: a value, a span, or both. */
export type Quotable = FactBase & { value?: number; range?: Range };

/** Where scientific notation starts, as the labs' equation lines print it. */
export const SCIENTIFIC_FROM = 1e5;

const symbolOf = (unit: Unit) =>
  isUnitId(unit) ? UNITS[unit].symbol : unit === "percent" ? "%" : "";

const exponentOf = (value: number) => Math.floor(Math.log10(Math.abs(value)));

/** Decimals that keep `digits` significant figures of `value`. */
const decimalsOf = (value: number, digits: number) =>
  value === 0 ? 0 : Math.max(0, digits - 1 - exponentOf(value));

const pluralRules = new Map<string, Intl.PluralRules>();

/** A printed number: digits, with group separators and a decimal mark between them. */
const NUMBER = /\d(?:[\d\s\u00a0\u202f.,]*\d)?/g;

/**
 * The plural category of the last number in a printed text in `locale` ("1,4–3,2 au" agrees
 * with 3,2): its visible decimals count ("4,0" is not "4"), group separators do not.
 */
export function pluralOf(locale: string, printed: string): Intl.LDMLPluralRule {
  const decimal = numberFormat(locale, 1, true)
    .formatToParts(1.1)
    .find((part) => part.type === "decimal")?.value;
  const last = printed.match(NUMBER)?.at(-1) ?? "0";
  const [whole = "0", fraction = ""] = last.split(decimal ?? ".");
  const digits = fraction.replace(/\D/g, "");
  const key = `${locale}|${digits.length}`;
  let rules = pluralRules.get(key);
  if (!rules) {
    rules = new Intl.PluralRules(locale, {
      minimumFractionDigits: digits.length,
      maximumFractionDigits: digits.length,
    });
    pluralRules.set(key, rules);
  }
  return rules.select(Number(`${whole.replace(/\D/g, "") || "0"}.${digits || "0"}`));
}

/** A figure's text in `locale` and the plural category of its last printed number. */
export function formatFigure(
  locale: string,
  fact: Quotable,
  options: FigureOptions = {},
): { text: string; plural: Intl.LDMLPluralRule } {
  const { style = "plain", perPower = 0, withUnit = false } = options;
  const unit: Unit = options.in ?? fact.show ?? fact.unit;
  const read = (v: number) =>
    (options.in && isUnitId(fact.unit) ? convert(v, fact.unit, options.in) : shown(fact, v)) /
    10 ** perPower;
  /* The ends quoted: the value, or the span when asked for or when there is no value. */
  const quoted = options.span || fact.value === undefined;
  const written =
    quoted && fact.range ? [...fact.range] : fact.value === undefined ? [] : [fact.value];
  const value = fact.value === undefined ? undefined : read(fact.value);
  const range = fact.range ? ([read(fact.range[0]), read(fact.range[1])] as const) : undefined;
  const ends = written.map(read);
  const given = options.digits ?? fact.digits;
  /* By default as many figures as the catalogue writes it with, before any conversion. */
  const digits = given ?? significantOf(...written);
  const fixed = given !== undefined;
  const number = (v: number) => formatSignificant(v, locale, digits, fixed);
  const suffix = withUnit && symbolOf(unit) ? ` ${symbolOf(unit)}` : "";

  if (style === "scientific" && ends.some((v) => Math.abs(v) >= SCIENTIFIC_FROM)) {
    const exponent = exponentOf(Math.max(...ends.map(Math.abs)));
    const mantissas = ends.map((v) =>
      numberFormat(locale, digits - 1, true).format(v / 10 ** exponent),
    );
    return { text: `${joinSpan(mantissas)} × ${powerOfTen(exponent)}${suffix}`, plural: "other" };
  }
  if ((style === "error" || style === "bounds") && value !== undefined && range) {
    const decimals = decimalsOf(value, digits);
    const spread = (v: number) => numberFormat(locale, decimals, true).format(v);
    const printed = number(value);
    const text =
      style === "error"
        ? `${printed} ± ${spread((range[1] - range[0]) / 2)}`
        : `${printed} (+${spread(range[1] - value)} / −${spread(value - range[0])})`;
    return { text: `${text}${suffix}`, plural: pluralOf(locale, printed) };
  }
  const printed = ends.map(number);
  return { text: `${joinSpan(printed)}${suffix}`, plural: pluralOf(locale, printed.at(-1) ?? "0") };
}

/** The bare number prose quotes: `formatFigure` with no options. */
export const quoteFact = (locale: string, fact: Quotable) => formatFigure(locale, fact).text;
