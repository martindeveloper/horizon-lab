/** Locale-aware number display shared by every readout: plain or scientific, Intl underneath. */

function finite(value: number) {
  if (!Number.isFinite(value)) throw new RangeError("Value must be finite");
}

/**
 * Display precision for a value: about three significant figures, and
 * scientific form (mantissa × 10^exponent) below 0.001 or from 10 million.
 * `exponent` is 0 for plain numbers.
 */
export type Readout = { mantissa: number; exponent: number; digits: number };

export function readout(value: number): Readout {
  finite(value);
  const abs = Math.abs(value);
  if (abs !== 0 && (abs < 1e-3 || abs >= 1e7)) {
    let exponent = Math.floor(Math.log10(abs));
    let mantissa = value / 10 ** exponent;
    // 9.996 × 10⁻⁵ would print as "10.00 × 10⁻⁵".
    if (Math.abs(Math.round(mantissa * 100) / 100) >= 10) {
      mantissa /= 10;
      exponent += 1;
    }
    return { mantissa, exponent, digits: 2 };
  }
  let digits = 0;
  if (abs < 1) {
    digits = 3;
  } else if (abs < 10) {
    digits = 2;
  } else if (abs < 100) {
    digits = 1;
  }
  return { mantissa: value, exponent: 0, digits };
}

const SUPERSCRIPT = "⁰¹²³⁴⁵⁶⁷⁸⁹";

/** A span's printed ends, joined by an en dash; one figure when both print alike ("3,600", not "3,600–3,600"). */
export function joinSpan(ends: readonly string[]) {
  return ends.every((end) => end === ends[0]) ? (ends[0] ?? "") : ends.join("–");
}

/** 10 and an exponent in superscript digits, e.g. "10⁻⁵". */
export function powerOfTen(exponent: number) {
  const digits = String(Math.abs(Math.trunc(exponent)))
    .split("")
    .map((d) => SUPERSCRIPT[Number(d)])
    .join("");
  return `10${exponent < 0 ? "⁻" : ""}${digits}`;
}

/** Intl formatters are costly to build; labels redraw every frame, so reuse them. */
const formatters = new Map<string, Intl.NumberFormat>();
export function numberFormat(locale: string, digits: number, fixed: boolean) {
  const key = `${locale}|${digits}|${fixed}`;
  let format = formatters.get(key);
  if (!format) {
    format = new Intl.NumberFormat(locale, {
      maximumFractionDigits: digits,
      minimumFractionDigits: fixed ? digits : 0,
    });
    formatters.set(key, format);
  }
  return format;
}

/** Formats a plain or scientific readout with Intl; `fixed` keeps trailing zeros. */
export function formatReadout(value: number, locale: string, fixed = false) {
  const r = readout(value);
  const number = numberFormat(locale, r.digits, fixed || r.exponent !== 0).format(r.mantissa);
  return r.exponent ? `${number} × ${powerOfTen(r.exponent)}` : number;
}

/** A number with fixed maximum decimals through the cached Intl formatter. */
export function formatNumber(value: number, locale: string, digits: number, fixed = false) {
  return numberFormat(locale, digits, fixed).format(value);
}

const significantFormatters = new Map<string, Intl.NumberFormat>();

/**
 * A literature value printed to `significant` figures, so a converted "60,000 ly" reads
 * "18,000 pc" rather than "18,396 pc". Scientific from 10 million as in `readout`, with a
 * bare power of ten for a one-figure 1 ("10¹⁷"), unless every whole digit is significant.
 */
export function formatSignificant(
  value: number,
  locale: string,
  significant: number,
  /** Keep trailing zeros that count ("2.0"): the figure was quoted to this precision. */
  fixed = false,
) {
  finite(value);
  const rounded = Number(value.toPrecision(significant));
  const abs = Math.abs(rounded);
  const exponent = abs === 0 ? 0 : Math.floor(Math.log10(abs));
  /* Large values stay plain when every whole digit is significant (an exact definition). */
  if (abs !== 0 && (abs < 1e-3 || (abs >= 1e7 && significant <= exponent))) {
    const mantissa = numberFormat(locale, significant - 1, true).format(rounded / 10 ** exponent);
    return mantissa === "1" ? powerOfTen(exponent) : `${mantissa} × ${powerOfTen(exponent)}`;
  }
  const key = `${locale}|${significant}|${fixed}`;
  let format = significantFormatters.get(key);
  if (!format) {
    format = new Intl.NumberFormat(locale, {
      maximumSignificantDigits: significant,
      ...(fixed ? { minimumSignificantDigits: significant } : {}),
    });
    significantFormatters.set(key, format);
  }
  return format.format(rounded);
}
