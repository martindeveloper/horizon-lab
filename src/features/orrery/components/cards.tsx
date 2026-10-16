import { NAMED, PLANET_RADIUS_KM, namedById, type PlanetId } from "@horizon/toolkit/bodies";
import { LIGHT_YEAR_AU } from "@horizon/toolkit/science";

import { namedElements, planetElements, rewinds, startElements } from "../lib/model/elements";
import { ORRERY_COPY, ORRERY_FIGURES } from "../lib/model/figures";
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
  auFigures,
  formatAu,
  formatYearsAgo,
  orbitFacts,
  type DistanceSettings,
  type Format,
  type Translate,
} from "./format";

export type Card = {
  badge: string;
  title: string;
  facts: { id: string; label: string; value: string }[];
  body: string;
  caution: string;
};

/** Everything a card reads besides its selection. */
type Moment = {
  t: Translate;
  f: Format;
  d: DistanceSettings;
  n: (v: number, digits: number) => string;
  yearsAgo: number;
  mig: number;
  elliptical: boolean;
  date: Date;
};

type Of<K extends Selection["kind"]> = Extract<Selection, { kind: K }>;

type MessageKey = Parameters<Moment["t"]>[0];

function factRows(
  t: Moment["t"],
  rows: readonly { id: string; label: MessageKey; value: MessageKey }[],
  values?: Parameters<Moment["t"]>[1],
) {
  return rows.map((row) => ({
    id: row.id,
    label: t(row.label),
    value: values === undefined ? t(row.value) : t(row.value, values),
  }));
}

function populationFacts(id: Of<"population">["id"], t: Moment["t"]) {
  switch (id) {
    case "asteroids":
      return factRows(t, [
        { id: "where", label: "facts.where", value: "cards.populations.asteroids.where" },
        { id: "mass", label: "facts.mass", value: "cards.populations.asteroids.mass" },
      ]);
    case "disk":
      return factRows(t, [
        { id: "drawnAt", label: "facts.drawnAt", value: "cards.populations.disk.drawnAt" },
        { id: "when", label: "facts.when", value: "cards.populations.disk.when" },
      ]);
    case "kuiper":
      return factRows(t, [
        { id: "region", label: "facts.region", value: "cards.populations.kuiper.region" },
        { id: "todayMass", label: "facts.todayMass", value: "cards.populations.kuiper.todayMass" },
        {
          id: "originalMass",
          label: "facts.originalMass",
          value: "cards.populations.kuiper.originalMass",
        },
      ]);
    case "scattered":
      return factRows(t, [
        { id: "shape", label: "facts.shape", value: "cards.populations.scattered.shape" },
        { id: "reach", label: "facts.reach", value: "cards.populations.scattered.reach" },
      ]);
    case "oort":
      return factRows(t, [
        { id: "innerEdge", label: "facts.innerEdge", value: "cards.populations.oort.innerEdge" },
        { id: "outerEdge", label: "facts.outerEdge", value: "cards.populations.oort.outerEdge" },
        { id: "shells", label: "facts.shells", value: "cards.populations.oort.shells" },
      ]);
    case "ejected":
      return factRows(t, [
        { id: "endState", label: "facts.endState", value: "cards.populations.ejected.endState" },
        { id: "share", label: "facts.share", value: "cards.populations.ejected.share" },
      ]);
  }
}

function galaxyFacts(id: Of<"galaxy">["id"], t: Moment["t"]) {
  switch (id) {
    case "sun":
      return factRows(
        t,
        [
          { id: "centre", label: "facts.centre", value: "cards.galaxy.sun.centre" },
          { id: "lap", label: "facts.lap", value: "cards.galaxy.sun.lap" },
          { id: "speed", label: "facts.speed", value: "cards.galaxy.sun.speed" },
          { id: "radial", label: "facts.radial", value: "cards.galaxy.sun.radial" },
          { id: "vertical", label: "facts.vertical", value: "cards.galaxy.sun.vertical" },
        ],
        ORRERY_COPY,
      );
    case "bulge":
      return factRows(
        t,
        [
          { id: "centre", label: "facts.centre", value: "cards.galaxy.bulge.centre" },
          { id: "bar", label: "facts.bar", value: "cards.galaxy.bulge.bar" },
        ],
        ORRERY_COPY,
      );
    case "halo":
      return factRows(
        t,
        [
          { id: "width", label: "facts.width", value: "cards.galaxy.halo.width" },
          { id: "mass", label: "facts.mass", value: "cards.galaxy.halo.mass" },
        ],
        ORRERY_COPY,
      );
    case "milkyway":
      return factRows(
        t,
        [
          { id: "diskWidth", label: "facts.diskWidth", value: "cards.galaxy.milkyway.diskWidth" },
          { id: "thickness", label: "facts.thickness", value: "cards.galaxy.milkyway.thickness" },
          { id: "stars", label: "facts.stars", value: "cards.galaxy.milkyway.stars" },
          { id: "age", label: "facts.age", value: "cards.galaxy.milkyway.age" },
        ],
        ORRERY_COPY,
      );
  }
}
export const NEIGHBOUR_IDS: readonly NeighbourId[] = NEIGHBOURS.map((n) => n.id);

function sunCard({ t, n }: Moment): Card {
  return {
    badge: t("badges.measured"),
    title: t("cards.sun.title"),
    facts: [
      {
        id: "radius",
        label: t("facts.radius"),
        value: t("cards.sun.radius", {
          km: n(ORRERY_FIGURES.sunRadiusKm, 0),
          au: n(ORRERY_FIGURES.sunRadiusAu, 4),
        }),
      },
      { id: "age", label: t("facts.age"), value: t("cards.sun.age") },
      { id: "au", label: t("facts.oneAu"), value: t("cards.sun.oneAu", auFigures(n)) },
    ],
    body: t("cards.sun.body"),
    caution: t("cards.sun.caution"),
  };
}

function planetCard(sel: Of<"planet">, { t, f, d, n, mig, elliptical, date }: Moment): Card {
  const id: PlanetId = sel.id;
  const el = planetElements(id, mig, 0, date);
  const now = planetElements(id, 1, 0, date);
  const start = startElements(id);
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
              value: t("facts.notMeasured", { value: n(start.a, 1) }),
            },
          ]
        : []),
      {
        id: "radius",
        label: t("facts.radius"),
        value: t("facts.km", { value: n(PLANET_RADIUS_KM[id], 0) }),
      },
      ...orbitFacts(t, f, d, el, ["nearFar", "period"]),
    ],
    body: t(`cards.planets.${id}`, auFigures(n)),
    caution: elliptical ? t("cards.planetCautionEllipse") : t("cards.planetCautionCircle"),
  };
}

function namedCard(sel: Of<"named">, { t, f, d, mig, date }: Moment): Card {
  const body = namedById(sel.id);
  const el = namedElements(body, mig, 0, date);
  return {
    badge: rewinds(sel.id) ? t("badges.rewound") : t("badges.presentOnly"),
    title: t(`names.${sel.id}`),
    facts: [
      { id: "average", label: t("facts.average"), value: formatAu(t, d, el.a) },
      ...orbitFacts(t, f, d, el, ["nearFar", "period"]),
    ],
    body: t(`cards.named.${sel.id}.summary`),
    caution: t(`cards.named.${sel.id}.caution`),
  };
}

function populationCard(sel: Of<"population">, { t }: Moment): Card {
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
    facts: populationFacts(sel.id, t),
    body: t(`cards.populations.${sel.id}.body`),
    caution: t(`cards.populations.${sel.id}.caution`),
  };
}

function tracerCard(sel: Of<"tracer">, { t, f, d, yearsAgo, mig }: Moment): Card {
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
      ? t("cards.tracer.cold")
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
    caution: t("cards.tracer.caution"),
  };
}

function starCard(sel: Of<"star">, { t, d, n, yearsAgo }: Moment): Card {
  const star = NEIGHBOURS.find((s) => s.id === sel.id)!;
  const inWindow = yearsAgo < 3e5;
  const ly = neighbourDistanceLy(star, inWindow ? yearsAgo : 0);
  const approach = closestApproach(star);
  const pastApproach = approach.yearsAgo > 0;
  return {
    badge: inWindow ? t("badges.measuredTrack") : t("badges.measured"),
    title: t(`names.${sel.id}`),
    facts: [
      {
        id: "distance",
        label: inWindow && yearsAgo > 5e4 ? t("facts.onSlider") : t("facts.today"),
        value: formatAu(t, d, ly * LIGHT_YEAR_AU, false),
      },
      { id: "direction", label: t("facts.direction"), value: t(`cards.stars.${sel.id}.where`) },
      { id: "motion", label: t("facts.motion"), value: t(`cards.stars.${sel.id}.motion`) },
      {
        id: "closest",
        label: t("facts.closest"),
        value: t(pastApproach ? "facts.closestPast" : "facts.closestFuture", {
          ly: n(approach.ly, 2),
          years: n(Math.abs(approach.yearsAgo) / 1e3, 0),
        }),
      },
    ],
    body: t(`cards.stars.${sel.id}.body`),
    caution: t("cards.stars.caution"),
  };
}

function galaxyCard(sel: Of<"galaxy">, { t }: Moment): Card {
  const badge =
    sel.id === "sun"
      ? t("badges.schematic")
      : sel.id === "halo"
        ? t("badges.inferred")
        : t("badges.sketch");
  return {
    badge,
    title: t(`cards.galaxy.${sel.id}.title`),
    facts: galaxyFacts(sel.id, t),
    body: t(`cards.galaxy.${sel.id}.body`, ORRERY_COPY),
    caution: t(`cards.galaxy.${sel.id}.caution`),
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
  const m: Moment = {
    t,
    f,
    d,
    n: (v, digits) => f.number(v, { maximumFractionDigits: digits }),
    yearsAgo,
    mig: migrationProgress(yearsAgo),
    elliptical,
    date,
  };
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
  }
}

export const NAMED_IDS = NAMED.map((body) => body.id);
