import type { useFormatter, useTranslations } from "next-intl";

import { periodYears, type Elements } from "@horizon/toolkit/bodies";
import {
  convert,
  formatDistance,
  formatDistanceRange,
  formatSignificant,
  type DistanceFormat,
  type DistanceUnit,
  type UnitId,
} from "@horizon/toolkit/science";

import { isLength, type Fact } from "../lib/model/catalogue";

export type Translate = ReturnType<typeof useTranslations<"orrery">>;
export type Format = ReturnType<typeof useFormatter>;

/** The visitor's distance unit and language, for the shared readout. */
export type DistanceSettings = { unit: DistanceUnit; locale: string };

function distanceFormat(t: Translate, d: DistanceSettings): DistanceFormat {
  return {
    unit: d.unit,
    locale: d.locale,
    symbols: { au: t("units.au"), ly: t("units.ly"), pc: t("units.pc") },
    millionWord: t("names.million"),
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

export type QuantityOptions = {
  /** The slider's moment: a figure with `at` follows it; without, its value today is printed. */
  yearsAgo?: number;
  /** Convert to this unit of the science kit first: years to "Gyr" for "billion years". */
  in?: UnitId;
  /** Then print in thousands, millions…: the message says "billion Suns" for 10⁹. */
  scale?: number;
  /** Significant figures for this sentence, when prose rounds harder than the fact row. */
  digits?: number;
};

/**
 * A catalogue figure in the visitor's language, as message arguments: `value` and, with a
 * range, `range` ("1,300–2,000"). Lengths come in the visitor's distance unit with its
 * symbol; other units leave their words to the message. Literature values keep their
 * significant figures (lengths at least two, so a conversion keeps its shape); figures
 * that follow the slider use the canvas readout unless the fact fixes `digits`.
 */
export function quantity(
  t: Translate,
  d: DistanceSettings,
  fact: Fact,
  { yearsAgo, in: to, scale = 1, digits: rounded }: QuantityOptions = {},
) {
  if (rounded !== undefined) fact = { ...fact, digits: rounded };
  const live = fact.at !== undefined && yearsAgo !== undefined;
  const value = live ? fact.at!(yearsAgo) : fact.value;
  const [low, high] = fact.range ?? [];
  const ranged = low !== undefined && high !== undefined;
  const { unit } = fact;
  if (isLength(unit)) {
    const au = (v: number) => convert(v, unit, "au");
    const format = distanceFormat(t, d);
    const significant = fact.digits ?? Math.max(2, significantOf(value));
    return {
      value: formatDistance(au(value), live && !fact.digits ? format : { ...format, significant }),
      range: ranged
        ? formatDistanceRange(au(low), au(high), {
            ...format,
            significant: fact.digits ?? Math.max(2, significantOf(low, high)),
          })
        : "",
    };
  }
  const plain = (v: number) =>
    (to && unit !== "count" && unit !== "percent" && unit !== "ratio" ? convert(v, unit, to) : v) /
    scale;
  const print = (v: number, digits: number) => formatSignificant(v, d.locale, digits);
  const digits = fact.digits ?? significantOf(plain(value));
  const rangeDigits = ranged ? (fact.digits ?? significantOf(plain(low), plain(high))) : 0;
  return {
    value: print(plain(value), digits),
    range: ranged ? `${print(plain(low), rangeDigits)}–${print(plain(high), rangeDigits)}` : "",
  };
}

export function formatYearsAgo(t: Translate, f: Format, years: number) {
  const n = (v: number, digits: number) =>
    f.number(v, { minimumFractionDigits: digits, maximumFractionDigits: digits });
  if (years <= 5e4) return t("time.today");
  if (years < 1e6) return t("time.thousand", { value: n(years / 1e3, 0) });
  if (years < 1e9) return t("time.million", { value: n(years / 1e6, years / 1e6 < 10 ? 1 : 0) });
  return t("time.billion", { value: n(years / 1e9, 2) });
}

function formatPeriod(t: Translate, f: Format, years: number) {
  const n = (v: number, digits: number) => f.number(v, { maximumFractionDigits: digits });
  if (years < 2) return t("facts.days", { value: n(years * 365.25, 0) });
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
      value: `${formatAu(t, d, el.a * (1 - e), false)} – ${formatAu(t, d, el.a * (1 + e), false)}`,
    },
    { id: ids[1], label: t("facts.period"), value: formatPeriod(t, f, periodYears(el.a)) },
  ];
}
