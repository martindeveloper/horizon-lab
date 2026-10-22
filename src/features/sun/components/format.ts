import { useLocale, useTranslations } from "next-intl";

import {
  factRef,
  print,
  type DistanceSettings,
  type Fact,
  type Format,
  type Translate,
} from "@/lib/facts";
import { SUN_CATALOGUE } from "@/space/sun/catalogue";
import { PASSBANDS } from "@/space/sun/model/passbands";
import { convert } from "@horizon/toolkit/science";

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

/** How much of the Sun's time has passed, in the largest unit that reads well. */
export function elapsedLabel(t: Translate, f: Format, seconds: number) {
  const one = { maximumFractionDigits: 1 };
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
  fe131: bands.fe131.temperature,
  eclipse: corona.temperature,
  magnetogram: field.polarField,
};

/** A light's legend: its wavelength where it has one, and the figure it answers to. */
export function lightLegend(t: Translate, f: Format, d: DistanceSettings, id: LightId) {
  const { nm } = PASSBANDS[id];
  const value = print(t, d, factRef(LIGHT_FACTS[id]));
  return nm > 0 ? `${f.number(nm, { maximumFractionDigits: 1 })} nm · ${value}` : value;
}
