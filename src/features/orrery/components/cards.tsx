import {
  buildCard,
  figure,
  formatAu,
  printAll,
  staticCard,
  type Card,
  type DistanceSettings,
  type Format,
  type Of,
  type Translate,
  type Value,
} from "@/lib/facts";
import {
  moonRows,
  orbitFacts,
  orbitRows,
  radiusRow,
  solarNameKey,
} from "@/space/solar-system/format";
import { SOLAR_CATALOGUE } from "@/space/solar-system/model/catalogue";
import { namedElements, planetElements, rewinds } from "@/space/solar-system/model/elements";
import { migrationProgress } from "@/space/solar-system/model/moment";
import { isObservatorySelection } from "@/space/solar-system/model/observatories";
import type { SolarSelection } from "@/space/solar-system/model/selection";
import { TRACERS, binOf, tracerElements } from "@/space/solar-system/model/tracers";
import { namedById, type PlanetId } from "@horizon/toolkit/bodies";

import type { OrrerySelection } from "../lib/model/selection";
import { NAMED_NOTES, PLANET_NOTES, POPULATION_CARDS, SUN_CARD, TRACER_NOTES } from "./card-specs";
import { formatYearsAgo } from "./format";
import { observatoryCard } from "./observatory-cards";

type Moment = {
  t: Translate;
  f: Format;
  d: DistanceSettings;
  yearsAgo: number;
  mig: number;
  elliptical: boolean;
  date: Date;
};

function planetCard(sel: Of<SolarSelection, "planet">, m: Moment): Card {
  const { t, f, d, mig, elliptical, date } = m;
  const id: PlanetId = sel.id;
  const el = planetElements(id, mig, 0, date);
  const now = planetElements(id, 1, 0, date);
  const { radius, start }: { radius: Value; start?: Value } = SOLAR_CATALOGUE.planets[id];
  const moved = !!start && mig < 0.999;
  return {
    badge: moved ? t("badges.endMeasured") : t("badges.measuredRounded"),
    title: t(solarNameKey(sel)),
    facts: [
      ...(moved
        ? [{ id: "slider", label: t("facts.onSlider"), value: formatAu(t, d, el.a, true) }]
        : []),
      { id: "today", label: t("facts.today"), value: formatAu(t, d, now.a, true) },
      ...(start
        ? [
            {
              id: "start",
              label: t("facts.modelStart"),
              value: t("facts.notMeasured", { value: figure(t, d, start) }),
            },
          ]
        : []),
      radiusRow(t, d, radius),
      ...orbitFacts(t, f, d, el),
    ],
    body: t(`cards.planets.${id}`, printAll(t, d, PLANET_NOTES[id])),
    caution: elliptical ? t("cards.planetCautionEllipse") : t("cards.planetCautionCircle"),
  };
}

function namedCard(sel: Of<SolarSelection, "named">, m: Moment): Card {
  const { t, f, d, mig, date } = m;
  const el = namedElements(namedById(sel.id), mig, 0, date);
  const notes = buildCard(t, d, NAMED_NOTES[sel.id] ?? { rows: [] });
  return {
    badge: rewinds(sel.id) ? t("badges.rewound") : t("badges.presentOnly"),
    title: t(solarNameKey(sel)),
    facts: orbitRows(t, f, d, el),
    body: t(`cards.named.${sel.id}.summary`, notes.body),
    caution: t(`cards.named.${sel.id}.caution`, notes.caution),
  };
}

function moonCard(sel: Of<SolarSelection, "moon">, { t, f, d }: Moment): Card {
  return {
    badge: t("badges.measured"),
    title: t(solarNameKey(sel)),
    facts: moonRows(t, f, d, sel.id),
    body: "",
    caution: "",
  };
}

function tracerCard(sel: Of<SolarSelection, "tracer">, m: Moment): Card {
  const { t, f, d, yearsAgo, mig } = m;
  const tr = TRACERS[sel.index];
  if (!tr)
    return {
      badge: t("badges.sample"),
      title: t("cards.tracer.title", { bin: "" }),
      facts: [],
      body: "",
      caution: "",
    };
  const el = tracerElements(tr, mig, 0);
  const bin = binOf(tr, mig);
  const note =
    tr.kind === "cold"
      ? t("cards.tracer.cold", printAll(t, d, TRACER_NOTES.cold))
      : tr.kind === "ejected"
        ? t("cards.tracer.ejected")
        : tr.kind === "oort"
          ? t("cards.tracer.oort")
          : t("cards.tracer.other");
  return {
    badge: t("badges.sample"),
    title: t("cards.tracer.title", { bin: t(`layers.${bin}`) }),
    facts: [
      { id: "when", label: t("facts.when"), value: formatYearsAgo(t, f, yearsAgo) },
      ...orbitRows(t, f, d, el),
    ],
    body: note,
    caution: t("cards.tracer.caution", printAll(t, d, TRACER_NOTES.caution)),
  };
}

/** The card for a selection at a moment on the timeline. Pure of React state. */
export function cardFor(
  t: Translate,
  f: Format,
  sel: OrrerySelection,
  yearsAgo: number,
  elliptical: boolean,
  date: Date,
  d: DistanceSettings,
): Card {
  if (isObservatorySelection(sel)) return observatoryCard(t, f, d, sel.id, date);
  const m: Moment = { t, f, d, yearsAgo, mig: migrationProgress(yearsAgo), elliptical, date };
  switch (sel.kind) {
    case "sun":
      return staticCard(t, d, "cards.sun", SUN_CARD);
    case "planet":
      return planetCard(sel, m);
    case "named":
      return namedCard(sel, m);
    case "moon":
      return moonCard(sel, m);
    case "population":
      return staticCard(t, d, `cards.populations.${sel.id}`, POPULATION_CARDS[sel.id]);
    case "tracer":
      return tracerCard(sel, m);
  }
}
