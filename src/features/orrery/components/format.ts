import type { useFormatter, useTranslations } from "next-intl";

import { periodYears, type Elements } from "@horizon/toolkit/bodies";
import { formatDistance, type DistanceUnit } from "@horizon/toolkit/science";

import { ORRERY_FIGURES } from "../lib/model/figures";

export type Translate = ReturnType<typeof useTranslations<"orrery">>;
export type Format = ReturnType<typeof useFormatter>;

/** The visitor's distance unit and language, for the shared readout. */
export type DistanceSettings = { unit: DistanceUnit; locale: string };

/** Same readout as the canvas labels: "5.37 au · light-time 45 min". */
export function formatAu(t: Translate, d: DistanceSettings, au: number, withLightTime = true) {
  return formatDistance(au, {
    unit: d.unit,
    locale: d.locale,
    symbols: { au: t("units.au"), ly: t("units.ly"), pc: t("units.pc") },
    ...(withLightTime ? { lightTimeLabel: t("names.lightTime") } : {}),
  });
}

export function formatYearsAgo(t: Translate, f: Format, years: number) {
  const n = (v: number, digits: number) => f.number(v, { maximumFractionDigits: digits });
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

/** 1 au in million km and light-minutes, from the shared constants. */
export function auFigures(n: (v: number, digits: number) => string) {
  return {
    millions: n(ORRERY_FIGURES.auMillionKm, 1),
    minutes: n(ORRERY_FIGURES.auLightMinutes, 1),
  };
}
