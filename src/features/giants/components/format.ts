import { useLocale, useTranslations } from "next-intl";

import {
  buildCard,
  factRef,
  print,
  type Card,
  type Fact,
  type DistanceSettings,
  type Translate,
} from "@/lib/facts";
import { formatSignificant } from "@horizon/toolkit/science";

import { RUNG_ENGINES, RUNG_FACTS, drawn, inUnit } from "../lib/model/catalogue";
import { RUNGS, type RungId } from "../lib/model/rungs";
import type { TourStep } from "../lib/model/tour";
import { RUNG_CARDS } from "./card-specs";

/** A guided-tour readout retains the same intervals as its card, with explicit length units. */
export function tourFigure(step: TourStep, t: Translate, distance: DistanceSettings) {
  const facts = RUNG_FACTS[step.rung];
  const at = (fact: Fact | undefined) => (fact ? print(t, distance, factRef(fact)) : null);
  const length = (unit: "au" | "km") => {
    const fact = facts.radius;
    const convert = inUnit(fact, unit);
    const values = fact.range ?? [fact.value!];
    const text = values
      .map((value) => formatSignificant(convert(value), distance.locale, fact.digits ?? 3))
      .join("–");
    return `${text} ${t(`units.${unit}`)}`;
  };
  switch (step.figure) {
    case "earths":
      return formatSignificant(
        inUnit(facts.radius, "km")(drawn(facts.radius)) /
          inUnit(RUNG_FACTS.earth.radius, "km")(drawn(RUNG_FACTS.earth.radius)),
        distance.locale,
        3,
      );
    case "density":
      return at(facts.density);
    case "luminosity":
      return at(facts.luminosity);
    case "radius":
      return length("km");
    case "orbit":
      return length("au");
    default:
      return null;
  }
}

/** Distances on Giants' cards: the unit chosen by size (au near, light-years far). */
export function useDistance(): DistanceSettings {
  return { unit: "auto", locale: useLocale() };
}

/** A rung's card: its class for a kicker, its name, figures, one remark and any caution. */
export function rungCard(
  t: Translate,
  d: DistanceSettings,
  id: RungId,
  has: (key: string) => boolean,
): Card {
  const rung = RUNGS.find((entry) => entry.id === id)!;
  const built = buildCard(t, d, RUNG_CARDS[id]);
  const engine = RUNG_ENGINES[id];
  const process = t(`engines.${engine.process}`);
  const powered = {
    id: "engine",
    label: t("facts.engine"),
    value: engine.debated
      ? t("engines.debated", {
          first: t(`engines.lead.${engine.process}`),
          second: t(`engines.then.${engine.debated}`),
        })
      : process,
  };
  const fate = rung.fate
    ? [{ id: "fate", label: t("facts.fate"), value: t(`fates.${rung.fate}`) }]
    : [];
  return {
    badge: rung.kind === "star" ? rung.type : t(`kinds.${rung.kind}`),
    title: t(`rungs.${id}.name`),
    facts: [...built.facts, powered, ...fate],
    body: t(`rungs.${id}.note`),
    caution: has(`rungs.${id}.caution`) ? t(`rungs.${id}.caution`) : "",
  };
}

/** The figures the dock reads out for the body in focus: its size, mass and surface. */
const KEY_ROWS = new Set(["radius", "horizon", "mass", "teff"]);

/** A rung's key figures, printed, for a line the visitor reads without opening the card. */
export function keyFigures(t: Translate, d: DistanceSettings, id: RungId) {
  const rows = RUNG_CARDS[id].rows.filter((row) => KEY_ROWS.has(row.id));
  return buildCard(t, d, { rows }).facts;
}

/** The namespace's translator, typed as the fact printers take it. */
export function useGiantsT(): { t: Translate; has: (key: string) => boolean } {
  const t = useTranslations("giants");
  return { t, has: (key) => t.has(key) };
}
