import { formatReadout } from "./format";
import { UNITS, convert, type Dimension, type UnitId } from "./units";

export type MeasureFormat = {
  locale: string;
  /** Translated symbols, e.g. Czech "sv. r." for ly; defaults to the SI / IAU symbol. */
  symbols?: Partial<Record<UnitId, string>>;
  /** Keep trailing zeros (stable label widths). */
  fixed?: boolean;
};

/**
 * A value with its unit. Convert with `to` / `in`, pick a readable unit from a
 * ladder with `best`, and print it with `format` or `toString`.
 *
 *   measure(5.2, "au").in("km")                  // 7.78e8
 *   measure(3.1e16, "m").best(["au", "ly", "pc"]) // ≈ 1.0 pc
 */
export class Measure {
  constructor(
    readonly value: number,
    readonly unit: UnitId,
  ) {
    if (!Number.isFinite(value)) throw new RangeError("Measure must be finite");
  }

  get dimension(): Dimension {
    return UNITS[this.unit].dimension;
  }

  /** The number in another unit of the same dimension. */
  in(unit: UnitId) {
    return convert(this.value, this.unit, unit);
  }

  to(unit: UnitId) {
    return new Measure(this.in(unit), unit);
  }

  /** The largest unit of the ladder in which the magnitude is at least 1 (else the smallest). */
  best(ladder: readonly UnitId[]) {
    let chosen = ladder[0] ?? this.unit;
    for (const unit of ladder) if (Math.abs(this.in(unit)) >= 1) chosen = unit;
    return this.to(chosen);
  }

  format({ locale, symbols, fixed }: MeasureFormat) {
    return `${formatReadout(this.value, locale, fixed)} ${symbols?.[this.unit] ?? UNITS[this.unit].symbol}`;
  }

  toString() {
    return this.format({ locale: "en" });
  }

  toLatex() {
    const text = formatReadout(this.value, "en").replace(/ × 10(.*)$/, (_, power: string) => {
      const exponent = Array.from(power)
        .map((c) => ("⁰¹²³⁴⁵⁶⁷⁸⁹".includes(c) ? String("⁰¹²³⁴⁵⁶⁷⁸⁹".indexOf(c)) : "-"))
        .join("");
      return ` \\times 10^{${exponent}}`;
    });
    return `${text.replaceAll(",", "{,}")}\\,${UNITS[this.unit].latex}`;
  }
}

export const measure = (value: number, unit: UnitId) => new Measure(value, unit);
