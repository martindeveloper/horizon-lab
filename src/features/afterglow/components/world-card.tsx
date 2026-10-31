"use client";

import { useFormatter, useLocale, useTranslations } from "next-intl";

import { SelectionSheet } from "@/components/simulations/selection-sheet";
import { proseArgs, type Card } from "@/lib/facts";
import { Action } from "@horizon/toolkit/ui";

import { PROSE_FIGURES } from "../lib/model/catalogue";
import {
  WORLDS,
  fateOf,
  lostBy,
  standingAt,
  temperatureAt,
  type WorldId,
} from "../lib/model/worlds";
import { useAfterglow } from "../lib/store";
import { formatFromToday, formatWidth, formatYears } from "./format";

type T = ReturnType<typeof useTranslations<"afterglow">>;
type F = ReturnType<typeof useFormatter>;

/** A world's fate in words: swallowed at an age, Earth's two readings, or spared. */
function fateWords(t: T, f: F, id: WorldId, locale: string) {
  const fate = fateOf(WORLDS[id].orbit);
  switch (fate.kind) {
    case "engulfed":
      return t("fates.engulfed", { when: formatFromToday(t, f, fate.age, locale) });
    case "uncertain":
      return t("fates.uncertain", { when: formatFromToday(t, f, fate.age, locale) });
    case "survives":
      return t("fates.survives");
  }
}

/** Sunlight as a share of Earth's today: "1.3×", "0.4 %", "2E-6". */
function sunlightWords(t: T, f: F, share: number) {
  if (share >= 0.1) {
    return t("units.times", { value: f.number(share, { maximumSignificantDigits: 2 }) });
  }
  if (share >= 1e-4) {
    return t("units.percent", { value: f.number(share * 100, { maximumSignificantDigits: 2 }) });
  }
  return t("units.times", {
    value: f.number(share, { notation: "scientific", maximumSignificantDigits: 2 }),
  });
}

/** A temperature in kelvin, to three figures; inside the Sun there is none. */
function kelvinWords(t: T, f: F, kelvin: number | null) {
  if (kelvin === null) return t("hud.insideSun");
  return t("units.kelvin", { value: f.number(kelvin, { maximumSignificantDigits: 3 }) });
}

export function worldCard(
  t: T,
  f: F,
  id: WorldId,
  age: number,
  figures: Record<string, string>,
  locale: string,
): Card {
  const world = WORLDS[id];
  const standing = standingAt(world.orbit, age);
  return {
    badge: t(lostBy(world.orbit, age) ? "badges.lost" : "badges.model"),
    title: t(`names.${id}`),
    facts: [
      {
        id: "sunlight",
        label: t("facts.sunlight"),
        value: standing.inside ? t("hud.insideSun") : sunlightWords(t, f, standing.sunlight),
      },
      { id: "sunWidth", label: t("facts.sunWidth"), value: formatWidth(t, f, standing.sunWidth) },
      {
        id: "orbit",
        label: t("facts.orbit"),
        value: t("units.auValue", {
          value: f.number(standing.distance, { maximumSignificantDigits: 3 }),
        }),
      },
      { id: "period", label: t("facts.period"), value: formatYears(t, f, standing.period, locale) },
      {
        id: "temperature",
        label: t("facts.temperature"),
        value: kelvinWords(t, f, temperatureAt(id, age)),
      },
      { id: "fate", label: t("facts.fate"), value: fateWords(t, f, id, locale) },
    ],
    body: t(`cards.${id}`, figures),
    caution: id === "earth" ? t("cards.earthCaution", figures) : "",
  };
}

/** The card of the world whose chip was tapped: its sunlight, the Sun's width, its orbit and its fate. */
export function WorldCard() {
  const t = useTranslations("afterglow");
  const f = useFormatter();
  const selection = useAfterglow((s) => s.selection);
  const world = useAfterglow((s) => s.world);
  const age = useAfterglow((s) => s.age);
  const locale = useLocale();
  const figures = proseArgs(PROSE_FIGURES, locale);
  if (!selection) return null;
  return (
    <SelectionSheet
      card={worldCard(t, f, selection, age, figures, locale)}
      closeLabel={t("hud.close")}
      onClose={() => useAfterglow.getState().select(null)}
      footer={
        /* A swallowed world cannot be stood on: its card only tells its fate. */
        selection === world || lostBy(WORLDS[selection].orbit, age) ? null : (
          <Action className="w-full" onClick={() => useAfterglow.getState().standOn(selection)}>
            {t("hud.standHere")}
          </Action>
        )
      }
    />
  );
}
