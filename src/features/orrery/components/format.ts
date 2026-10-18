import type { useFormatter, useTranslations } from "next-intl";

import { periodYears, type Elements } from "@horizon/toolkit/bodies";
import {
  convert,
  formatDistance,
  formatDistanceRange,
  formatSignificant,
  type DistanceFormat,
  type DistanceChoice,
} from "@horizon/toolkit/science";

import {
  PROSE_FIGURES,
  isLength,
  type Fact,
  type Live,
  type Range,
  type Span,
  type Value,
} from "../lib/model/catalogue";
import { isToday } from "../lib/model/timeline";

export type Translate = ReturnType<typeof useTranslations<"orrery">>;
export type Format = ReturnType<typeof useFormatter>;

/** The visitor's distance unit and language, for the shared readout. */
export type DistanceSettings = { unit: DistanceChoice; locale: string };

function distanceFormat(t: Translate, d: DistanceSettings): DistanceFormat {
  return {
    unit: d.unit,
    locale: d.locale,
    symbols: { au: t("units.au"), ly: t("units.ly"), pc: t("units.pc") },
    millionWord: t("names.million"),
    billionWord: t("names.billion"),
  };
}

/** Same readout as the canvas labels: "5.37 au · light-time 45 min". */
export function formatAu(t: Translate, d: DistanceSettings, au: number, withLightTime = true) {
  return formatDistance(au, {
    ...distanceFormat(t, d),
    ...(withLightTime ? { lightTimeLabel: t("names.lightTime") } : {}),
  });
}

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

type Figure = Value | Live;
type Ranged = (Value | Span) & { range: Range };

/** A plain figure in the unit the message words (`show`), as a number. */
function shown(fact: Fact, v: number) {
  const { unit, show } = fact;
  return show && unit !== "count" && unit !== "percent" && unit !== "ratio"
    ? convert(v, unit, show)
    : v;
}

/**
 * Plain numbers in words a reader takes in: "6.5 billion", "4 million"; scientific from
 * 10¹² ("5 × 10¹⁶"). An exact value whose every digit counts stays whole.
 */
function plain(
  t: Translate,
  d: DistanceSettings,
  values: number[],
  digits: number,
  fixed: boolean,
) {
  const top = Math.max(...values.map(Math.abs));
  const whole = top > 0 && digits > Math.floor(Math.log10(top));
  const scale = whole || top < 1e6 || top >= 1e12 ? 1 : top >= 1e9 ? 1e9 : 1e6;
  const text = values.map((v) => formatSignificant(v / scale, d.locale, digits, fixed)).join("–");
  return scale === 1 ? text : `${text} ${t(scale === 1e9 ? "names.billion" : "names.million")}`;
}

/**
 * A catalogue figure today, in the visitor's language: lengths in their distance unit with
 * its symbol, other units in the unit the message words. Literature values keep their
 * significant figures; lengths at least two, so a conversion keeps its shape.
 */
export function figure(t: Translate, d: DistanceSettings, fact: Figure) {
  return printed(t, d, fact, fact.value, fact.digits);
}

/** A figure that follows the slider, `yearsAgo` years ago, in the canvas readout's precision. */
export function figureAt(t: Translate, d: DistanceSettings, fact: Live, yearsAgo: number) {
  return printed(t, d, fact, fact.at(yearsAgo), fact.digits, true);
}

function printed(
  t: Translate,
  d: DistanceSettings,
  fact: Fact,
  value: number,
  digits: number | undefined,
  live = false,
) {
  const { unit } = fact;
  if (isLength(unit)) {
    const format = distanceFormat(t, d);
    const au = convert(value, unit, "au");
    if (live && digits === undefined) return formatDistance(au, format);
    return formatDistance(au, {
      ...format,
      significant: digits ?? Math.max(2, significantOf(value)),
    });
  }
  return plain(t, d, [shown(fact, value)], digits ?? significantOf(value), digits !== undefined);
}

/** A published span, the unit once: "2.1–3.3 au", "1,300–2,000", "4–5" (billion years). */
export function span(t: Translate, d: DistanceSettings, fact: Ranged) {
  const [low, high] = fact.range;
  const { unit } = fact;
  if (isLength(unit))
    return formatDistanceRange(convert(low, unit, "au"), convert(high, unit, "au"), {
      ...distanceFormat(t, d),
      significant: fact.digits ?? Math.max(2, significantOf(low, high)),
    });
  const ends = [shown(fact, low), shown(fact, high)];
  return plain(t, d, ends, fact.digits ?? significantOf(low, high), fact.digits !== undefined);
}

/**
 * A figure as prose quotes it: a number, or a span, in the unit the sentence names (`show`,
 * lengths included), with the significant figures it is written with.
 */
export function quote(locale: string, fact: Fact) {
  const ends = fact.value !== undefined ? [fact.value] : [...fact.range];
  const digits = fact.digits ?? significantOf(...ends);
  const fixed = fact.digits !== undefined;
  return ends.map((v) => formatSignificant(shown(fact, v), locale, digits, fixed)).join("–");
}

const proseCache = new Map<string, Record<string, string>>();

/** Every figure the notes, guide and technical notes quote, for `t()`, once per language. */
export function proseArgs(locale: string) {
  let args = proseCache.get(locale);
  if (!args) {
    args = Object.fromEntries(
      Object.entries(PROSE_FIGURES).map(([name, fact]) => [name, quote(locale, fact)]),
    );
    proseCache.set(locale, args);
  }
  return args;
}

export function formatYearsAgo(t: Translate, f: Format, years: number) {
  const n = (v: number, digits: number) =>
    f.number(v, { minimumFractionDigits: digits, maximumFractionDigits: digits });
  if (isToday(years)) return t("time.today");
  if (years < 1e6) return t("time.thousand", { value: n(years / 1e3, 0) });
  if (years < 1e9) return t("time.million", { value: n(years / 1e6, years / 1e6 < 10 ? 1 : 0) });
  return t("time.billion", { value: n(years / 1e9, 2) });
}

function formatPeriod(t: Translate, f: Format, years: number) {
  const n = (v: number, digits: number) => f.number(v, { maximumFractionDigits: digits });
  if (years < 2) return t("facts.days", { value: n(convert(years, "yr", "d"), 0) });
  if (years < 1000) return t("facts.years", { value: n(years, years < 20 ? 1 : 0) });
  return t("facts.yearsAbout", { value: n(years, 0) });
}

/** Stretch, tilt, near–far and period rows for an orbit. */
export function orbitFacts(
  t: Translate,
  f: Format,
  d: DistanceSettings,
  el: Elements,
  ids: [string, string],
) {
  const n = (v: number, digits: number) => f.number(v, { maximumFractionDigits: digits });
  const e = Math.min(el.e, 0.995);
  const tilt = t("facts.tiltValue", { value: n(Math.abs(el.i) < 0.05 ? 0 : el.i, 1) });
  return [
    { id: "stretch", label: t("facts.stretch"), value: n(e, 3) },
    {
      id: "tilt",
      label: t("facts.tilt"),
      value: el.i > 90 ? `${tilt} · ${t("facts.retrograde")}` : tilt,
    },
    {
      id: ids[0],
      label: t("facts.nearFar"),
      value: formatDistanceRange(el.a * (1 - e), el.a * (1 + e), distanceFormat(t, d)),
    },
    { id: ids[1], label: t("facts.period"), value: formatPeriod(t, f, periodYears(el.a)) },
  ];
}
