import {
  r,
  row,
  v,
  type Args,
  type Badge as SharedBadge,
  type CardSpec,
  type StaticCard,
} from "@/lib/facts";
/**
 * What each card shows, as data: rows (a fact label, the message that words it and the
 * catalogue figures that fill its placeholders) and the figures its body and caution quote.
 * A new object needs its facts in the catalogue, its words in the messages and an entry here;
 * cards.tsx builds every card from these (the Sun and populations wholly; planets, named
 * bodies and tracers add rows from their orbits).
 * tests/simulation-shared.test.mjs checks that each message's placeholders match the
 * arguments given here, in both languages.
 */
import { POPULATION_FIGURES } from "@/space/solar-system/cards";
import { SOLAR_CATALOGUE } from "@/space/solar-system/model/catalogue";
import type { Bin } from "@/space/solar-system/model/tracers";
import type { PlanetId } from "@horizon/toolkit/bodies";

/** The shared badges, and the Orrery's own for figures the timeline moves or models (`badges.<id>`). */
export type Badge =
  | SharedBadge
  | "measuredRounded"
  | "endMeasured"
  | "presentOnly"
  | "rewound"
  | "region"
  | "model"
  | "sample";

const P = SOLAR_CATALOGUE.populations;
const F = POPULATION_FIGURES;

/** 1 au in km and light-minutes, from the science kit's exact definitions. */
const auArgs = {
  au: v(SOLAR_CATALOGUE.sun.sun.au),
  minutes: v(SOLAR_CATALOGUE.sun.sun.auLightTime),
};

export const SUN_CARD: StaticCard<Badge> = {
  badge: "measured",
  rows: [
    row("radius", "cards.sun.radius", {
      km: v(SOLAR_CATALOGUE.sun.sun.radius),
      au: v(SOLAR_CATALOGUE.sun.sun.radiusAu),
    }),
    row("age", "cards.sun.age", { value: v(SOLAR_CATALOGUE.sun.sun.age) }),
    { id: "oneAu", text: "cards.sun.oneAu", args: auArgs },
  ],
  body: { mass: v(SOLAR_CATALOGUE.sun.sun.massShare), spin: v(SOLAR_CATALOGUE.sun.sun.spinShare) },
  caution: { diameters: v(SOLAR_CATALOGUE.sun.sun.earthDiameters) },
};

/** Planet rows are the orbit itself (cards.tsx); their notes quote these. */
export const PLANET_NOTES: Partial<Record<PlanetId, Args>> = {
  earth: { ...auArgs, metres: v(SOLAR_CATALOGUE.planets.earth.auMetres) },
  neptune: { end: v(SOLAR_CATALOGUE.planets.neptune.end) },
};

export const NAMED_NOTES: Partial<Record<"pluto" | "sedna" | "halley", CardSpec>> = {
  sedna: {
    rows: [],
    body: {
      near: v(SOLAR_CATALOGUE.named.sedna.perihelion),
      far: v(SOLAR_CATALOGUE.named.sedna.aphelion),
    },
  },
  halley: { rows: [], caution: { a: v(SOLAR_CATALOGUE.named.halley.semiMajorAxis) } },
};

export const POPULATION_CARDS: Record<"asteroids" | Bin, StaticCard<Badge>> = {
  asteroids: {
    badge: "region",
    rows: [
      row("where", "cards.populations.asteroids.where", { range: F.asteroids.where }),
      row("mass", "cards.populations.asteroids.mass", { value: F.asteroids.mass }),
    ],
  },
  disk: {
    badge: "model",
    rows: [
      row("drawnAt", "cards.populations.disk.drawnAt", { range: F.disk.drawnAt }),
      row("when", "cards.populations.disk.when"),
    ],
    body: { mass: F.disk.mass },
  },
  kuiper: {
    badge: "mixed",
    rows: [
      row("region", "cards.populations.kuiper.region", { range: F.kuiper.region }),
      row("todayMass", "cards.populations.kuiper.todayMass", { value: F.kuiper.todayMass }),
      row("originalMass", "cards.populations.kuiper.originalMass", {
        value: F.kuiper.originalMass,
      }),
    ],
    body: {
      catalogued: F.kuiper.catalogued,
      cliff: F.kuiper.cliff,
      cold: F.kuiper.cold,
      plutinos: F.kuiper.plutinos,
    },
  },
  scattered: {
    badge: "region",
    rows: [
      row("shape", "cards.populations.scattered.shape"),
      row("reach", "cards.populations.scattered.reach"),
    ],
  },
  oort: {
    badge: "inferred",
    rows: [
      row("innerEdge", "cards.populations.oort.innerEdge", { range: F.oort.innerEdge }),
      row("outerEdge", "cards.populations.oort.outerEdge", { range: F.oort.outerEdge }),
      row("shells", "cards.populations.oort.shells", {
        inner: F.oort.innerShell,
        outer: F.oort.outerShell,
      }),
    ],
  },
  ejected: {
    badge: "model",
    rows: [
      row("endState", "cards.populations.ejected.endState"),
      row("share", "cards.populations.ejected.share"),
    ],
  },
};

/** A sampled planetesimal's note and caution. */
export const TRACER_NOTES = {
  cold: { range: r(P.tracers.coldClassicals) },
  caution: { count: v(P.tracers.count) },
} satisfies Record<string, Args>;
