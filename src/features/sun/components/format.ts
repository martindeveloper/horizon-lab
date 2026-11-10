import { useLocale, useTranslations } from "next-intl";

import { type DistanceSettings, type Fact, type Format, type Translate } from "@/lib/facts";
import { SUN_CATALOGUE } from "@/space/sun/catalogue";
import { convert, formatFigure } from "@horizon/toolkit/science";

import type { LightId } from "../lib/model/lights";

/** The lab's copy, typed loosely as every card helper takes it. */
export function useSunT() {
  const t: Translate = useTranslations("sun");
  return t;
}

/** Distances on the Sun's cards: km near, au beyond. */
export function useDistance(): DistanceSettings {
  return { unit: "auto", locale: useLocale() };
}

/** How much of the Sun's time has passed, in the largest unit that reads well; one fixed decimal, so the ticking readout keeps its width. */
export function elapsedLabel(t: Translate, f: Format, seconds: number) {
  const one = { minimumFractionDigits: 1, maximumFractionDigits: 1 };
  if (seconds < 90) return t("elapsed.seconds", { value: f.number(Math.round(seconds)) });
  const minutes = convert(seconds, "s", "min");
  if (minutes < 90) return t("elapsed.minutes", { value: f.number(Math.round(minutes)) });
  const hours = convert(seconds, "s", "h");
  if (hours < 36) return t("elapsed.hours", { value: f.number(hours, one) });
  const days = convert(seconds, "s", "d");
  if (days < 400) return t("elapsed.days", { value: f.number(days, one) });
  return t("elapsed.years", { value: f.number(convert(seconds, "s", "yr"), one) });
}

const { photosphere, chromosphere } = SUN_CATALOGUE.layers;
const bands = SUN_CATALOGUE.passbands;

/** Temperatures from here up read in millions of kelvin ("1.2 million K"). */
const MILLION_K = 1e6;

/** A light's figure with its unit: a temperature in kelvin, in millions once in the corona; the field in gauss. */
function lightFigure(t: Translate, locale: string, fact: Fact) {
  if (fact.unit === "T")
    return formatFigure(locale, fact, { in: "G", withUnit: true, span: true }).text;
  const low = fact.value ?? fact.range?.[0] ?? 0;
  if (low < MILLION_K) return formatFigure(locale, fact, { withUnit: true, span: true }).text;
  const { text } = formatFigure(locale, fact, { perPower: 6, digits: 2, span: true });
  return `${text} ${t("names.million")} K`;
}

/** Spectral modes are not thermometers. Show both representative AIA peaks where present. */
export function lightLegend(t: Translate, d: DistanceSettings, id: LightId) {
  if (id === "magnetogram") return t("lightReading.polarity");
  if (id === "eclipse") return t("lightReading.scattered");
  if (id === "white")
    return t("lightReading.effective", {
      value: lightFigure(t, d.locale, photosphere.temperature),
    });
  if (id === "halpha")
    return `${formatFigure(d.locale, chromosphere.halpha, { withUnit: true }).text} · ${t("lightReading.lineTransfer")}`;
  const band = bands[id];
  const peaks = [
    band.temperature,
    ...(band.secondaryTemperature ? [band.secondaryTemperature] : []),
  ];
  return t("lightReading.response", {
    value: peaks.map((fact) => lightFigure(t, d.locale, fact)).join(" / "),
  });
}
