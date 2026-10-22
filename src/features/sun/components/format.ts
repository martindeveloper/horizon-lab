import { useLocale, useTranslations } from "next-intl";

import { type DistanceSettings, type Fact, type Format, type Translate } from "@/lib/facts";
import { SUN_CATALOGUE } from "@/space/sun/catalogue";
import { PASSBANDS } from "@/space/sun/model/passbands";
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

const { photosphere, chromosphere, corona } = SUN_CATALOGUE.layers;
const { field } = SUN_CATALOGUE.activity;
const bands = SUN_CATALOGUE.passbands;

/** What each light answers to, as the catalogue has it: the temperature of the gas it shows, or the field it reads. */
const LIGHT_FACTS: Readonly<Record<LightId, Fact>> = {
  white: photosphere.temperature,
  halpha: chromosphere.temperature,
  he304: bands.he304.temperature,
  fe171: bands.fe171.temperature,
  fe193: bands.fe193.temperature,
  fe211: bands.fe211.temperature,
  fe335: bands.fe335.temperature,
  fe94: bands.fe94.temperature,
  /* 131 Å stands at the ruler's hot end for its Fe XXI flare peak, so that is the figure it quotes. */
  fe131: bands.fe131.secondaryTemperature ?? bands.fe131.temperature,
  eclipse: corona.temperature,
  magnetogram: field.polarField,
};

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

/** A light's legend: its wavelength where it has one, and the figure it answers to. */
export function lightLegend(t: Translate, f: Format, d: DistanceSettings, id: LightId) {
  const { nm } = PASSBANDS[id];
  const text = lightFigure(t, d.locale, LIGHT_FACTS[id]);
  return nm > 0 ? `${f.number(nm, { maximumFractionDigits: 1 })} nm · ${text}` : text;
}
