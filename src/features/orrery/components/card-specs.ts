import {
  r,
  row,
  specEntries,
  v,
  type Args,
  type CardSpec,
  type SpecEntry,
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
import { SOLAR_CATALOGUE } from "@/space/solar-system/model/catalogue";
import type { Bin } from "@/space/solar-system/model/tracers";
import type { PlanetId } from "@horizon/toolkit/bodies";

/** What a card's kicker says about how far its figures can be trusted (`badges.<id>`). */
export type Badge =
  | "measured"
  | "measuredRounded"
  | "endMeasured"
  | "presentOnly"
  | "rewound"
  | "region"
  | "model"
  | "mixed"
  | "inferred"
  | "sample"
  | "sketch"
  | "schematic";

const P = SOLAR_CATALOGUE.populations;

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
      row("where", "cards.populations.asteroids.where", { range: r(P.asteroids.where) }),
      row("mass", "cards.populations.asteroids.mass", { value: v(P.asteroids.mass) }),
    ],
  },
  disk: {
    badge: "model",
    rows: [
      row("drawnAt", "cards.populations.disk.drawnAt", { range: r(P.disk.drawnAt) }),
      row("when", "cards.populations.disk.when"),
    ],
    body: { mass: v(P.disk.mass) },
  },
  kuiper: {
    badge: "mixed",
    rows: [
      row("region", "cards.populations.kuiper.region", { range: r(P.kuiper.region) }),
      row("todayMass", "cards.populations.kuiper.todayMass", { value: v(P.kuiper.todayMass) }),
      row("originalMass", "cards.populations.kuiper.originalMass", {
        value: v(P.kuiper.originalMass),
      }),
    ],
    body: {
      catalogued: v(P.kuiper.catalogued),
      cliff: v(P.kuiper.cliff),
      cold: r(P.kuiper.coldClassicals),
      plutinos: v(P.kuiper.plutinos),
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
      row("innerEdge", "cards.populations.oort.innerEdge", { range: r(P.oort.innerEdge) }),
      row("outerEdge", "cards.populations.oort.outerEdge", { range: r(P.oort.outerEdge) }),
      row("shells", "cards.populations.oort.shells", {
        inner: v(P.oort.innerShell),
        outer: v(P.oort.outerShell),
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

/** Every definition with its body and caution message keys, for the placeholder test. */
export function cardSpecs(): SpecEntry[] {
  return [
    ...specEntries({ sun: SUN_CARD }, "cards"),
    ...specEntries(NAMED_NOTES, "cards.named", "summary"),
    ...specEntries(POPULATION_CARDS, "cards.populations"),
  ];
}
