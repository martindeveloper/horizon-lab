/**
 * What each card shows, as data: rows (a fact label, the message that words it and the
 * catalogue figures that fill its placeholders) and the figures its body and caution quote.
 * A new object needs its facts in the catalogue, its words in the messages and an entry here;
 * cards.tsx builds every card from these (stars add their distance and closest approach).
 * tests/simulation-shared.test.mjs checks that each message's placeholders match the arguments
 * given here, in both languages.
 */
import { figureRow, r, row, v, type CardSpec, type StaticCard, type Badge } from "@/lib/facts";
import type { NeighbourId } from "@/space/galaxy/model/neighbours";

import { CATALOGUE } from "../lib/model/catalogue";
import type { CosmosId } from "../lib/store";

/** What a card's kicker says about how far its figures can be trusted (`badges.<id>`). */

const G = CATALOGUE.galaxy;
const C = CATALOGUE.cosmos;
const S = CATALOGUE.stars;

export const GALAXY_CARDS: Record<"milkyway" | "sun" | "bulge" | "halo", StaticCard<Badge>> = {
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
      merger: v(G.milkyway.gaiaEnceladus),
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

/** Structures beyond the Galaxy, as they are today. */
export const COSMOS_CARDS: Record<CosmosId, StaticCard<Badge>> = {
  localGroup: {
    badge: "mixed",
    rows: [
      row("width", "cards.cosmos.localGroup.width", { value: v(C.localGroup.width) }),
      row("members", "cards.cosmos.localGroup.members", { value: v(C.localGroup.members) }),
      row("mass", "cards.cosmos.localGroup.mass"),
      figureRow("apart", v(C.localGroup.apart)),
    ],
    body: {
      turnaround: v(C.localGroup.turnaround),
      turnaroundAgo: v(C.localGroup.turnaroundAgo),
    },
  },
  localSheet: {
    badge: "mixed",
    rows: [
      row("width", "cards.cosmos.localSheet.width", { value: v(C.localSheet.width) }),
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
      figureRow("distance", v(C.andromeda.distance)),
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
      figureRow("distance", v(C.triangulum.distance)),
      row("width", "cards.cosmos.triangulum.width", { value: v(C.triangulum.width) }),
      row("future", "cards.cosmos.triangulum.future"),
    ],
  },
  virgo: {
    badge: "mixed",
    rows: [
      figureRow("distance", v(C.virgo.distance)),
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
    body: { within: v({ ...C.fornax.distance, digits: 2 }) },
    rows: [
      figureRow("distance", v(C.fornax.distance)),
      row("members", "cards.cosmos.fornax.members", { value: v(C.fornax.members) }),
      row("width", "cards.cosmos.fornax.width", { value: v(C.fornax.width) }),
      row("heart", "cards.cosmos.fornax.heart"),
    ],
  },
  supercluster: {
    badge: "sketch",
    rows: [
      row("width", "cards.cosmos.supercluster.width", { value: v(C.supercluster.width) }),
      row("members", "cards.cosmos.supercluster.members", { value: v(C.supercluster.members) }),
      row("heart", "cards.cosmos.supercluster.heart"),
    ],
  },
  centaurus: {
    badge: "mixed",
    rows: [
      figureRow("distance", v(C.centaurus.distance)),
      row("members", "cards.cosmos.centaurus.members"),
      row("heart", "cards.cosmos.centaurus.heart"),
    ],
  },
  hydra: {
    badge: "mixed",
    rows: [
      figureRow("distance", v(C.hydra.distance)),
      row("members", "cards.cosmos.hydra.members", { value: v(C.hydra.members) }),
      row("heart", "cards.cosmos.hydra.heart"),
    ],
  },
  greatAttractor: {
    badge: "mixed",
    rows: [
      figureRow("distance", v(C.greatAttractor.distance)),
      row("where", "cards.cosmos.greatAttractor.where"),
      row("mass", "cards.cosmos.greatAttractor.mass", { value: v(C.greatAttractor.mass) }),
      row("heart", "cards.cosmos.greatAttractor.heart"),
    ],
    body: { distance: v(C.greatAttractor.distance) },
  },
  laniakea: {
    badge: "sketch",
    rows: [
      row("width", "cards.cosmos.laniakea.width", { value: v(C.laniakea.width) }),
      row("members", "cards.cosmos.laniakea.members", { value: v(C.laniakea.members) }),
      row("mass", "cards.cosmos.laniakea.mass", { value: v(C.laniakea.mass) }),
      row("heart", "cards.cosmos.laniakea.heart", { value: v(C.laniakea.heart) }),
    ],
  },
  perseusPisces: {
    badge: "mixed",
    rows: [
      figureRow("distance", v(C.perseusPisces.distance)),
      row("length", "cards.cosmos.perseusPisces.length", { value: v(C.perseusPisces.length) }),
      row("where", "cards.cosmos.perseusPisces.where"),
    ],
  },
  coma: {
    badge: "mixed",
    rows: [
      figureRow("distance", v(C.coma.distance)),
      row("members", "cards.cosmos.coma.members", { value: v(C.coma.members) }),
      row("mass", "cards.cosmos.coma.mass", { value: v(C.coma.mass) }),
      row("heart", "cards.cosmos.coma.heart"),
    ],
  },
  shapley: {
    badge: "mixed",
    rows: [
      figureRow("distance", v(C.shapley.distance)),
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
    rows: [
      figureRow("distance", v(C.sloanGreatWall.distance)),
      row("length", "cards.cosmos.sloanGreatWall.length", {
        value: v(C.sloanGreatWall.length),
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
    rows: [
      figureRow("edge", v(C.observableUniverse.edge)),
      row("cmb", "cards.cosmos.observableUniverse.cmb", {
        distance: v(C.observableUniverse.cmbDistance),
        age: v(C.observableUniverse.cmbAge),
      }),
      row("temperature", "cards.cosmos.observableUniverse.temperature", {
        value: v(C.observableUniverse.cmbTemperature),
      }),
      row("age", "cards.cosmos.observableUniverse.age", {
        value: v(C.observableUniverse.lightTravel),
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
