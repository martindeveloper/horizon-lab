import { NAMED, namedById, type PlanetId } from "@horizon/toolkit/bodies";
import { LIGHT_YEAR_AU } from "@horizon/toolkit/science";

import { CATALOGUE, type Value } from "../lib/model/catalogue";
import { namedElements, planetElements, rewinds } from "../lib/model/elements";
import {
  NEIGHBOURS,
  closestApproach,
  neighbourDistanceLy,
  type NeighbourId,
} from "../lib/model/neighbours";
import { migrationProgress } from "../lib/model/timeline";
import { TRACERS, binOf, tracerElements } from "../lib/model/tracers";
import type { Selection } from "../lib/store";
import {
  COSMOS_CARDS,
  GALAXY_CARDS,
  NAMED_NOTES,
  PLANET_NOTES,
  POPULATION_CARDS,
  STAR_CARDS,
  SUN_CARD,
  TRACER_NOTES,
  type Args,
  type CardSpec,
  type Ref,
} from "./card-specs";
import {
  figure,
  figureAt,
  formatAu,
  formatYearsAgo,
  orbitFacts,
  span,
  type DistanceSettings,
  type Format,
  type Translate,
} from "./format";

export type Card = {
  badge: string;
  title: string;
  facts: Fact[];
  body: string;
  caution: string;
};
type Fact = { id: string; label: string; value: string };

/** Everything a card reads besides its selection. */
type Moment = {
  t: Translate;
  f: Format;
  d: DistanceSettings;
  yearsAgo: number;
  mig: number;
  elliptical: boolean;
  date: Date;
};

type Of<K extends Selection["kind"]> = Extract<Selection, { kind: K }>;

/** A catalogue figure for this moment, in the visitor's unit and language. */
function print({ t, d, yearsAgo }: Moment, ref: Ref) {
  switch (ref.kind) {
    case "value":
      return figure(t, d, ref.fact);
    case "span":
      return span(t, d, ref.fact);
    case "live":
      return figureAt(t, d, ref.fact, yearsAgo);
  }
}

function printAll(m: Moment, args: Args = {}) {
  return Object.fromEntries(Object.entries(args).map(([name, ref]) => [name, print(m, ref)]));
}

/** A definition's rows, body and caution arguments, printed for this moment. */
function build(m: Moment, spec: CardSpec) {
  const facts: Fact[] = spec.rows.map((row) => ({
    id: row.id,
    label: m.t(`facts.${row.id}`),
    value: row.figure ? print(m, row.figure) : m.t(row.text, printAll(m, row.args)),
  }));
  return { facts, body: printAll(m, spec.body), caution: printAll(m, spec.caution) };
}

export const NEIGHBOUR_IDS: readonly NeighbourId[] = NEIGHBOURS.map((n) => n.id);

function sunCard(m: Moment): Card {
  const { t } = m;
  const built = build(m, SUN_CARD);
  return {
    badge: t("badges.measured"),
    title: t("cards.sun.title"),
    facts: built.facts,
    body: t("cards.sun.body", built.body),
    caution: t("cards.sun.caution", built.caution),
  };
}

function planetCard(sel: Of<"planet">, m: Moment): Card {
  const { t, f, d, mig, elliptical, date } = m;
  const id: PlanetId = sel.id;
  const el = planetElements(id, mig, 0, date);
  const now = planetElements(id, 1, 0, date);
  const { radius, start }: { radius: Value; start?: Value } = CATALOGUE.planets[id];
  const moved = !!start && mig < 0.999;
  return {
    badge: moved ? t("badges.endMeasured") : t("badges.measuredRounded"),
    title: t(`names.${id}`),
    facts: [
      ...(moved ? [{ id: "slider", label: t("facts.onSlider"), value: formatAu(t, d, el.a) }] : []),
      { id: "today", label: t("facts.today"), value: formatAu(t, d, now.a) },
      ...(start
        ? [
            {
              id: "start",
              label: t("facts.modelStart"),
              value: t("facts.notMeasured", { value: figure(t, d, start) }),
            },
          ]
        : []),
      {
        id: "radius",
        label: t("facts.radius"),
        value: t("facts.km", { value: figure(t, d, radius) }),
      },
      ...orbitFacts(t, f, d, el, ["nearFar", "period"]),
    ],
    body: t(`cards.planets.${id}`, printAll(m, PLANET_NOTES[id])),
    caution: elliptical ? t("cards.planetCautionEllipse") : t("cards.planetCautionCircle"),
  };
}

function namedCard(sel: Of<"named">, m: Moment): Card {
  const { t, f, d, mig, date } = m;
  const el = namedElements(namedById(sel.id), mig, 0, date);
  const notes = build(m, NAMED_NOTES[sel.id] ?? { rows: [] });
  return {
    badge: rewinds(sel.id) ? t("badges.rewound") : t("badges.presentOnly"),
    title: t(`names.${sel.id}`),
    facts: [
      { id: "average", label: t("facts.average"), value: formatAu(t, d, el.a) },
      ...orbitFacts(t, f, d, el, ["nearFar", "period"]),
    ],
    body: t(`cards.named.${sel.id}.summary`, notes.body),
    caution: t(`cards.named.${sel.id}.caution`, notes.caution),
  };
}

function populationCard(sel: Of<"population">, m: Moment): Card {
  const { t } = m;
  const built = build(m, POPULATION_CARDS[sel.id]);
  const badge =
    sel.id === "asteroids" || sel.id === "scattered"
      ? t("badges.region")
      : sel.id === "kuiper"
        ? t("badges.mixed")
        : sel.id === "oort"
          ? t("badges.inferred")
          : t("badges.model");
  return {
    badge,
    title: t(`cards.populations.${sel.id}.title`),
    facts: built.facts,
    body: t(`cards.populations.${sel.id}.body`, built.body),
    caution: t(`cards.populations.${sel.id}.caution`, built.caution),
  };
}

function tracerCard(sel: Of<"tracer">, m: Moment): Card {
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
      ? t("cards.tracer.cold", printAll(m, TRACER_NOTES.cold))
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
      { id: "average", label: t("facts.average"), value: formatAu(t, d, el.a) },
      ...orbitFacts(t, f, d, el, ["nearFar", "period"]),
    ],
    body: note,
    caution: t("cards.tracer.caution", printAll(m, TRACER_NOTES.caution)),
  };
}

/** A neighbour: its distance and closest approach from its track, the rest from its definition. */
function starCard(sel: Of<"star">, m: Moment): Card {
  const { t, d, yearsAgo } = m;
  const star = NEIGHBOURS.find((s) => s.id === sel.id)!;
  const inWindow = yearsAgo < 3e5;
  const ly = neighbourDistanceLy(star, inWindow ? yearsAgo : 0);
  const c = CATALOGUE.stars[sel.id];
  const built = build(m, STAR_CARDS[sel.id]);
  return {
    badge: inWindow ? t("badges.measuredTrack") : t("badges.measured"),
    title: t(`names.${sel.id}`),
    facts: [
      {
        id: "distance",
        label: inWindow && yearsAgo > 5e4 ? t("facts.onSlider") : t("facts.today"),
        value: formatAu(t, d, ly * LIGHT_YEAR_AU, false),
      },
      ...built.facts,
      {
        id: "closest",
        label: t("facts.closest"),
        value: t(closestApproach(star).yearsAgo > 0 ? "facts.closestPast" : "facts.closestFuture", {
          distance: figure(t, d, c.approach),
          years: figure(t, d, c.approachWhen),
        }),
      },
    ],
    body: t(`cards.stars.${sel.id}.body`, built.body),
    caution: t("cards.stars.caution"),
  };
}

function galaxyCard(sel: Of<"galaxy">, m: Moment): Card {
  const { t } = m;
  const built = build(m, GALAXY_CARDS[sel.id]);
  const badge =
    sel.id === "sun"
      ? t("badges.schematic")
      : sel.id === "halo"
        ? t("badges.inferred")
        : t("badges.sketch");
  return {
    badge,
    title: t(`cards.galaxy.${sel.id}.title`),
    facts: built.facts,
    body: t(`cards.galaxy.${sel.id}.body`, built.body),
    caution: t(`cards.galaxy.${sel.id}.caution`, built.caution),
  };
}

/** Beyond the Galaxy, with the scale of space once it differs from today's. */
function cosmosCard(sel: Of<"cosmos">, m: Moment): Card {
  const { t, f, yearsAgo } = m;
  const key = `cards.cosmos.${sel.id}` as const;
  const built = build(m, COSMOS_CARDS[sel.id]);
  const unbound = sel.id !== "localGroup" && sel.id !== "andromeda" && sel.id !== "triangulum";
  const scale = CATALOGUE.cosmos.universe.scale.at(yearsAgo);
  const then: Fact[] =
    unbound && yearsAgo >= 1e7
      ? [
          {
            id: "scaleThen",
            label: t("facts.scaleThen"),
            value: t("cards.cosmos.scaleThen", { value: f.number(scale, { style: "percent" }) }),
          },
        ]
      : [];
  return {
    badge:
      sel.id === "supercluster" || sel.id === "laniakea" ? t("badges.sketch") : t("badges.mixed"),
    title: t(`${key}.title`),
    facts: [...built.facts, ...then],
    body: t(`${key}.body`, built.body),
    caution: t(`${key}.caution`, built.caution),
  };
}

/** The card for a selection at a moment on the timeline. Pure of React state. */
export function cardFor(
  t: Translate,
  f: Format,
  sel: Selection,
  yearsAgo: number,
  elliptical: boolean,
  date: Date,
  d: DistanceSettings,
): Card {
  const m: Moment = { t, f, d, yearsAgo, mig: migrationProgress(yearsAgo), elliptical, date };
  switch (sel.kind) {
    case "sun":
      return sunCard(m);
    case "planet":
      return planetCard(sel, m);
    case "named":
      return namedCard(sel, m);
    case "population":
      return populationCard(sel, m);
    case "tracer":
      return tracerCard(sel, m);
    case "star":
      return starCard(sel, m);
    case "galaxy":
      return galaxyCard(sel, m);
    case "cosmos":
      return cosmosCard(sel, m);
  }
}

export const NAMED_IDS = NAMED.map((body) => body.id);
