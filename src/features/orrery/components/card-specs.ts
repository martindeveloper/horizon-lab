/**
 * What each card shows, as data: rows (a fact label, the message that words it and the
 * catalogue figures that fill its placeholders) and the figures its body and caution quote.
 * A new object needs its facts in the catalogue, its words in the messages and an entry here;
 * cards.tsx builds every card from these (the Sun, populations, the Galaxy and the cosmos
 * wholly; planets, named bodies, tracers and stars add rows from their orbits and tracks).
 * tests/orrery-catalogue.test.mjs checks that each message's placeholders match the
 * arguments given here, in both languages.
 */
import type { PlanetId } from "@horizon/toolkit/bodies";

import { CATALOGUE, type Live, type Range, type Span, type Value } from "../lib/model/catalogue";
import type { NeighbourId } from "../lib/model/neighbours";
import type { Bin } from "../lib/model/tracers";
import type { CosmosId, Selection } from "../lib/store";

/** How a figure fills a placeholder: today's value, a published span, or the slider's moment. */
export type Ref =
  | { kind: "value"; fact: Value | Live }
  | { kind: "span"; fact: (Value | Span) & { range: Range } }
  | { kind: "live"; fact: Live };

export const v = (fact: Value | Live): Ref => ({ kind: "value", fact });
export const r = (fact: (Value | Span) & { range: Range }): Ref => ({ kind: "span", fact });
export const live = (fact: Live): Ref => ({ kind: "live", fact });

export type Args = Readonly<Record<string, Ref>>;

/**
 * A row: its label is `facts.<id>`; its value the message `text` with `args`, or a figure
 * alone (`figure`).
 */
export type Row =
  | { id: string; text: string; args?: Args; figure?: never }
  | { id: string; figure: Ref; text?: never; args?: never };

/** What a card's kicker says about how far its figures can be trusted (`badges.<id>`). */
export type Badge =
  | "measured"
  | "measuredTrack"
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

export type CardSpec = {
  rows: readonly Row[];
  /** Arguments of the card's body and caution messages. */
  body?: Args;
  caution?: Args;
};

/**
 * A card wholly described here: its kicker and, for structures the expansion of space
 * stretches, a row with the scale of space once it differs from today's.
 */
export type StaticCard = CardSpec & { badge: Badge; expands?: true };

const row = (id: string, text: string, args?: Args): Row =>
  args ? { id, text, args } : { id, text };
const figureRow = (id: string, figure: Ref): Row => ({ id, figure });

const P = CATALOGUE.populations;
const G = CATALOGUE.galaxy;
const C = CATALOGUE.cosmos;
const S = CATALOGUE.stars;

/** 1 au in km and light-minutes, from the science kit's exact definitions. */
const auArgs = { au: v(CATALOGUE.sun.sun.au), minutes: v(CATALOGUE.sun.sun.auLightTime) };

export const SUN_CARD: StaticCard = {
  badge: "measured",
  rows: [
    row("radius", "cards.sun.radius", {
      km: v(CATALOGUE.sun.sun.radius),
      au: v(CATALOGUE.sun.sun.radiusAu),
    }),
    row("age", "cards.sun.age", { value: v(CATALOGUE.sun.sun.age) }),
    { id: "oneAu", text: "cards.sun.oneAu", args: auArgs },
  ],
  body: { mass: v(CATALOGUE.sun.sun.massShare), spin: v(CATALOGUE.sun.sun.spinShare) },
  caution: { diameters: v(CATALOGUE.sun.sun.earthDiameters) },
};

/** Planet rows are the orbit itself (cards.tsx); their notes quote these. */
export const PLANET_NOTES: Partial<Record<PlanetId, Args>> = {
  earth: { ...auArgs, metres: v(CATALOGUE.planets.earth.auMetres) },
  neptune: { end: v(CATALOGUE.planets.neptune.end) },
};

export const NAMED_NOTES: Partial<Record<"pluto" | "sedna" | "halley", CardSpec>> = {
  sedna: {
    rows: [],
    body: {
      near: v(CATALOGUE.named.sedna.perihelion),
      far: v(CATALOGUE.named.sedna.aphelion),
    },
  },
  halley: { rows: [], caution: { a: v(CATALOGUE.named.halley.semiMajorAxis) } },
};

export const POPULATION_CARDS: Record<"asteroids" | Bin, StaticCard> = {
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

export const GALAXY_CARDS: Record<"milkyway" | "sun" | "bulge" | "halo", StaticCard> = {
  sun: {
    badge: "schematic",
    rows: [
      row("centre", "cards.galaxy.sun.centre", { value: v(G.sun.centre) }),
      row("lap", "cards.galaxy.sun.lap", { value: v(G.sun.lap), range: r(G.sun.lap) }),
      row("speed", "cards.galaxy.sun.speed", {
        value: v(G.sun.circularSpeed),
        sun: v(G.sun.sunSpeed),
      }),
      row("radial", "cards.galaxy.sun.radial", {
        value: v(G.sun.radialSwing),
        period: v(G.sun.radialPeriod),
      }),
      row("vertical", "cards.galaxy.sun.vertical", {
        value: v(G.sun.verticalAmplitude),
        period: v(G.sun.verticalPeriod),
        height: v(G.sun.height),
      }),
    ],
    body: { laps: v(G.sun.laps) },
  },
  bulge: {
    badge: "sketch",
    rows: [
      row("centre", "cards.galaxy.bulge.centre", { value: v(G.bulge.centre) }),
      row("bar", "cards.galaxy.bulge.bar", {
        value: v(G.bulge.bar),
        range: r(G.bulge.bar),
        angle: v(G.bulge.barAngle),
      }),
    ],
    body: { mass: v(G.bulge.blackHole) },
  },
  halo: {
    badge: "inferred",
    rows: [
      row("width", "cards.galaxy.halo.width", { value: v(G.halo.width) }),
      row("mass", "cards.galaxy.halo.mass"),
    ],
  },
  milkyway: {
    badge: "sketch",
    rows: [
      row("diskWidth", "cards.galaxy.milkyway.diskWidth", { value: v(G.milkyway.diskWidth) }),
      row("thickness", "cards.galaxy.milkyway.thickness", { value: v(G.milkyway.thickness) }),
      row("stars", "cards.galaxy.milkyway.stars", { value: v(G.milkyway.stars) }),
      row("age", "cards.galaxy.milkyway.age", { value: v(G.milkyway.age) }),
    ],
    body: {
      bar: v(G.milkyway.barAngle),
      pitch: v(G.milkyway.armPitch),
      merger: r(G.milkyway.gaiaEnceladus),
    },
    caution: { tilt: v(G.milkyway.planeTilt) },
  },
};

/** A neighbour's direction and motion rows and its note; distance and approach come from its track. */
export const STAR_CARDS: Record<NeighbourId, CardSpec> = {
  proxima: {
    rows: [
      row("direction", "cards.stars.proxima.where"),
      row("motion", "cards.stars.proxima.motion", {
        velocity: v(S.proxima.radialVelocity),
        proper: v(S.proxima.properMotion),
      }),
    ],
  },
  alphaCen: {
    rows: [
      row("direction", "cards.stars.alphaCen.where", { separation: v(S.alphaCen.fromProxima) }),
      row("motion", "cards.stars.alphaCen.motion", { velocity: v(S.alphaCen.radialVelocity) }),
    ],
    body: {
      distance: v(S.alphaCen.distance),
      proxima: v(S.alphaCen.proximaOut),
      approach: v(S.alphaCen.approach),
      years: v(S.alphaCen.approachWhen),
    },
  },
  barnard: {
    rows: [
      row("direction", "cards.stars.barnard.where"),
      row("motion", "cards.stars.barnard.motion", {
        velocity: v(S.barnard.radialVelocity),
        proper: v(S.barnard.properMotion),
      }),
    ],
    body: {
      distance: v(S.barnard.distance),
      approach: v(S.barnard.approach),
      years: v(S.barnard.approachWhen),
    },
  },
  scholz: {
    rows: [
      row("direction", "cards.stars.scholz.where", { distance: v(S.scholz.distance) }),
      row("motion", "cards.stars.scholz.motion", { velocity: v(S.scholz.radialVelocity) }),
    ],
    body: { flyby: r(S.scholz.flyby) },
  },
};

/**
 * Structures beyond the Galaxy. Distances and sizes that change with time follow the slider;
 * those not bound to the Local Group `expand` with space.
 */
export const COSMOS_CARDS: Record<CosmosId, StaticCard> = {
  localGroup: {
    badge: "mixed",
    rows: [
      row("width", "cards.cosmos.localGroup.width", { value: v(C.localGroup.width) }),
      row("members", "cards.cosmos.localGroup.members", { value: v(C.localGroup.members) }),
      row("mass", "cards.cosmos.localGroup.mass"),
      figureRow("apart", live(C.localGroup.apart)),
    ],
    body: {
      turnaround: v(C.localGroup.turnaround),
      turnaroundAgo: v(C.localGroup.turnaroundAgo),
    },
  },
  localSheet: {
    badge: "mixed",
    expands: true,
    rows: [
      row("width", "cards.cosmos.localSheet.width", { value: live(C.localSheet.width) }),
      row("depth", "cards.cosmos.localSheet.thickness", { value: v(C.localSheet.thickness) }),
      row("members", "cards.cosmos.localSheet.members"),
      row("motion", "cards.cosmos.localSheet.motion", {
        value: v(C.localSheet.fromVoid),
        stray: v(C.localSheet.stray),
      }),
    ],
    body: { radius: v(C.localSheet.radius) },
  },
  andromeda: {
    badge: "mixed",
    rows: [
      figureRow("distance", live(C.andromeda.distance)),
      row("approach", "cards.cosmos.andromeda.approach", {
        value: v(C.andromeda.approach),
        sun: v(C.andromeda.approachSun),
      }),
      row("width", "cards.cosmos.andromeda.width", { range: r(C.andromeda.width) }),
      row("future", "cards.cosmos.andromeda.future", { range: r(C.andromeda.firstPass) }),
    ],
    body: {
      sun: v(C.andromeda.approachSun),
      approach: v(C.andromeda.approach),
      distance: v(C.andromeda.distance),
    },
    caution: { within: v(C.andromeda.mergerWithin) },
  },
  triangulum: {
    badge: "mixed",
    rows: [
      figureRow("distance", live(C.triangulum.distance)),
      row("width", "cards.cosmos.triangulum.width", { value: v(C.triangulum.width) }),
      row("future", "cards.cosmos.triangulum.future"),
    ],
  },
  virgo: {
    badge: "mixed",
    expands: true,
    rows: [
      figureRow("distance", live(C.virgo.distance)),
      row("members", "cards.cosmos.virgo.members", {
        value: v(C.virgo.members),
        range: r(C.virgo.members),
      }),
      row("width", "cards.cosmos.virgo.width", { value: v(C.virgo.width) }),
      row("heart", "cards.cosmos.virgo.heart", { value: v(C.virgo.blackHole) }),
    ],
  },
  fornax: {
    badge: "mixed",
    expands: true,
    rows: [
      figureRow("distance", live(C.fornax.distance)),
      row("members", "cards.cosmos.fornax.members", { value: v(C.fornax.members) }),
      row("width", "cards.cosmos.fornax.width", { value: v(C.fornax.width) }),
      row("heart", "cards.cosmos.fornax.heart"),
    ],
  },
  supercluster: {
    badge: "sketch",
    expands: true,
    rows: [
      row("width", "cards.cosmos.supercluster.width", { value: live(C.supercluster.width) }),
      row("members", "cards.cosmos.supercluster.members", { value: v(C.supercluster.members) }),
      row("heart", "cards.cosmos.supercluster.heart"),
    ],
  },
  centaurus: {
    badge: "mixed",
    expands: true,
    rows: [
      figureRow("distance", live(C.centaurus.distance)),
      row("members", "cards.cosmos.centaurus.members"),
      row("heart", "cards.cosmos.centaurus.heart"),
    ],
  },
  hydra: {
    badge: "mixed",
    expands: true,
    rows: [
      figureRow("distance", live(C.hydra.distance)),
      row("members", "cards.cosmos.hydra.members", { value: v(C.hydra.members) }),
      row("heart", "cards.cosmos.hydra.heart"),
    ],
  },
  greatAttractor: {
    badge: "mixed",
    expands: true,
    rows: [
      figureRow("distance", live(C.greatAttractor.distance)),
      row("where", "cards.cosmos.greatAttractor.where"),
      row("mass", "cards.cosmos.greatAttractor.mass", { value: v(C.greatAttractor.mass) }),
      row("heart", "cards.cosmos.greatAttractor.heart"),
    ],
    body: { distance: v(C.greatAttractor.distance) },
  },
  laniakea: {
    badge: "sketch",
    expands: true,
    rows: [
      row("width", "cards.cosmos.laniakea.width", { value: live(C.laniakea.width) }),
      row("members", "cards.cosmos.laniakea.members", { value: v(C.laniakea.members) }),
      row("mass", "cards.cosmos.laniakea.mass", { value: v(C.laniakea.mass) }),
      row("heart", "cards.cosmos.laniakea.heart", { value: v(C.laniakea.heart) }),
    ],
  },
  perseusPisces: {
    badge: "mixed",
    expands: true,
    rows: [
      figureRow("distance", live(C.perseusPisces.distance)),
      row("length", "cards.cosmos.perseusPisces.length", { value: v(C.perseusPisces.length) }),
      row("where", "cards.cosmos.perseusPisces.where"),
    ],
  },
  coma: {
    badge: "mixed",
    expands: true,
    rows: [
      figureRow("distance", live(C.coma.distance)),
      row("members", "cards.cosmos.coma.members", { value: v(C.coma.members) }),
      row("mass", "cards.cosmos.coma.mass", { value: v(C.coma.mass) }),
      row("heart", "cards.cosmos.coma.heart"),
    ],
  },
  shapley: {
    badge: "mixed",
    expands: true,
    rows: [
      figureRow("distance", live(C.shapley.distance)),
      row("members", "cards.cosmos.shapley.members", {
        clusters: v(C.shapley.clusters),
        galaxies: v(C.shapley.galaxies),
      }),
      row("mass", "cards.cosmos.shapley.mass", { value: v(C.shapley.mass) }),
      row("where", "cards.cosmos.shapley.where"),
    ],
  },
  sloanGreatWall: {
    badge: "mixed",
    expands: true,
    rows: [
      figureRow("distance", live(C.sloanGreatWall.distance)),
      row("length", "cards.cosmos.sloanGreatWall.length", {
        value: live(C.sloanGreatWall.length),
        past: v(C.sloanGreatWall.lengthThen),
      }),
      row("lookback", "cards.cosmos.sloanGreatWall.lookback", {
        value: v(C.sloanGreatWall.lookback),
      }),
      row("where", "cards.cosmos.sloanGreatWall.where"),
    ],
    body: { distance: v(C.sloanGreatWall.distance) },
  },
  observableUniverse: {
    badge: "mixed",
    expands: true,
    rows: [
      figureRow("edge", live(C.observableUniverse.edge)),
      row("cmb", "cards.cosmos.observableUniverse.cmb", {
        distance: live(C.observableUniverse.cmbDistance),
        age: v(C.observableUniverse.cmbAge),
      }),
      row("temperature", "cards.cosmos.observableUniverse.temperature", {
        value: live(C.observableUniverse.cmbTemperature),
      }),
      row("age", "cards.cosmos.observableUniverse.age", {
        value: live(C.observableUniverse.lightTravel),
      }),
    ],
    body: { age: v(C.universe.age) },
    caution: {
      near: v(C.observableUniverse.ringNear),
      mid: v(C.observableUniverse.ringMid),
      far: v(C.observableUniverse.ringFar),
    },
  },
};

/** Every definition with its body and caution message keys, for the placeholder test. */
export function cardSpecs(): {
  kind: Selection["kind"];
  body: string;
  caution: string;
  spec: CardSpec;
}[] {
  const of = (
    kind: Selection["kind"],
    specs: Readonly<Record<string, CardSpec | undefined>>,
    prefix: string,
    body = "body",
  ) =>
    Object.entries(specs).flatMap(([id, spec]) =>
      spec
        ? [{ kind, body: `${prefix}.${id}.${body}`, caution: `${prefix}.${id}.caution`, spec }]
        : [],
    );
  return [
    { kind: "sun", body: "cards.sun.body", caution: "cards.sun.caution", spec: SUN_CARD },
    ...of("named", NAMED_NOTES, "cards.named", "summary"),
    ...of("population", POPULATION_CARDS, "cards.populations"),
    ...of("galaxy", GALAXY_CARDS, "cards.galaxy"),
    ...of("star", STAR_CARDS, "cards.stars"),
    ...of("cosmos", COSMOS_CARDS, "cards.cosmos"),
  ];
}
