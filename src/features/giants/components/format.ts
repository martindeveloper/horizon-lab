import { useLocale, useTranslations, type useFormatter } from "next-intl";

import {
  buildCard,
  factRef,
  print,
  proseArgs,
  type Card,
  type Fact,
  type DistanceSettings,
  type Translate,
} from "@/lib/facts";
import { formatSignificant } from "@horizon/toolkit/science";

import {
  PROSE_FIGURES,
  RUNG_ENGINES,
  RUNG_FACTS,
  drawn,
  inUnit,
  spectralOf,
} from "../lib/model/catalogue";
import { groupOf } from "../lib/model/compare";
import { rungNameKey } from "../lib/model/names";
import type { RulerUnit } from "../lib/model/ruler";
import { rungById, type Rung, type RungId } from "../lib/model/rungs";
import type { TourStep } from "../lib/model/tour";
import { RUNG_CARDS } from "./card-specs";

/** A ruler's round length in its unit, as the scale bar and the overview's lines print it. */
export const lengthText = (
  t: Translate,
  f: Pick<ReturnType<typeof useFormatter>, "number">,
  value: number,
  unit: RulerUnit,
) => `${f.number(value, { maximumSignificantDigits: 3 })} ${t(`units.${unit}`)}`;

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

/**
 * What a body is, in words: a remnant's or brown dwarf's own name, a star's luminosity class
 * (main sequence, giant, supergiant), or else its kind.
 */
export function badgeOf(t: Translate, rung: Rung) {
  if (rung.label) return t(`kinds.${rung.label}`);
  const group = rung.kind === "star" ? groupOf(rung.id) : undefined;
  return t(`kinds.${group ?? rung.kind}`);
}

/**
 * A rung's card: what it is for a kicker, its name, figures (its spectral type second, with how
 * to read one), one remark and any caution.
 */
export function rungCard(
  t: Translate,
  d: DistanceSettings,
  id: RungId,
  has: (key: string) => boolean,
): Card {
  const rung = rungById(id);
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
  const type = spectralOf(id);
  const spectral = type
    ? [{ id: "spectral", label: t("facts.spectral"), value: `${type} · ${t("card.spectralHint")}` }]
    : [];
  const [lead, ...rest] = built.facts;
  const fate = rung.fate
    ? [{ id: "fate", label: t("facts.fate"), value: t(`fates.${rung.fate}`) }]
    : [];
  return {
    badge: badgeOf(t, rung),
    title: t(rungNameKey(id)),
    facts: [...(lead ? [lead] : []), ...spectral, ...rest, powered, ...fate],
    body: t(`rungs.${id}.note`),
    caution: has(`rungs.${id}.caution`)
      ? t(`rungs.${id}.caution`, proseArgs(PROSE_FIGURES, d.locale))
      : "",
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
