import { NAMED, namedById, type PlanetId } from "@horizon/toolkit/bodies";
import { LIGHT_YEAR_AU } from "@horizon/toolkit/science";

import { CATALOGUE, type Live, type Range, type Span, type Value } from "../lib/model/catalogue";
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
  facts: { id: string; label: string; value: string }[];
  body: string;
  caution: string;
};

/** How a card prints catalogue figures: today's value, a published span, or a live value. */
type Print = {
  v: (fact: Value | Live) => string;
  r: (fact: (Value | Span) & { range: Range }) => string;
  live: (fact: Live) => string;
};

/** Everything a card reads besides its selection. */
type Moment = {
  t: Translate;
  f: Format;
  d: DistanceSettings;
  p: Print;
  yearsAgo: number;
  mig: number;
  elliptical: boolean;
  date: Date;
};

type Of<K extends Selection["kind"]> = Extract<Selection, { kind: K }>;

function populationFacts(id: Of<"population">["id"], { t, p: { v, r } }: Moment) {
  type FactId =
    | "where"
    | "mass"
    | "drawnAt"
    | "when"
    | "region"
    | "todayMass"
    | "originalMass"
    | "shape"
    | "reach"
    | "innerEdge"
    | "outerEdge"
    | "shells"
    | "endState"
    | "share";
  const row = (id: FactId, value: string) => ({ id, label: t(`facts.${id}`), value });
  switch (id) {
    case "asteroids": {
      const c = CATALOGUE.populations.asteroids;
      return [
        row("where", t("cards.populations.asteroids.where", { range: r(c.where) })),
        row("mass", t("cards.populations.asteroids.mass", { value: v(c.mass) })),
      ];
    }
    case "disk":
      return [
        row(
          "drawnAt",
          t("cards.populations.disk.drawnAt", { range: r(CATALOGUE.populations.disk.drawnAt) }),
        ),
        row("when", t("cards.populations.disk.when")),
      ];
    case "kuiper": {
      const c = CATALOGUE.populations.kuiper;
      return [
        row("region", t("cards.populations.kuiper.region", { range: r(c.region) })),
        row("todayMass", t("cards.populations.kuiper.todayMass", { value: v(c.todayMass) })),
        row(
          "originalMass",
          t("cards.populations.kuiper.originalMass", { value: v(c.originalMass) }),
        ),
      ];
    }
    case "scattered":
      return [
        row("shape", t("cards.populations.scattered.shape")),
        row("reach", t("cards.populations.scattered.reach")),
      ];
    case "oort": {
      const c = CATALOGUE.populations.oort;
      return [
        row("innerEdge", t("cards.populations.oort.innerEdge", { range: r(c.innerEdge) })),
        row("outerEdge", t("cards.populations.oort.outerEdge", { range: r(c.outerEdge) })),
        row(
          "shells",
          t("cards.populations.oort.shells", { inner: v(c.innerShell), outer: v(c.outerShell) }),
        ),
      ];
    }
    case "ejected":
      return [
        row("endState", t("cards.populations.ejected.endState")),
        row("share", t("cards.populations.ejected.share")),
      ];
  }
}

/** Figures in a population card's body. */
function populationBody(id: Of<"population">["id"], { p: { v, r } }: Moment) {
  switch (id) {
    case "disk":
      return { mass: v(CATALOGUE.populations.disk.mass) };
    case "kuiper": {
      const c = CATALOGUE.populations.kuiper;
      return {
        catalogued: v(c.catalogued),
        cliff: v(c.cliff),
        cold: r(c.coldClassicals),
        plutinos: v(c.plutinos),
      };
    }
    default:
      return {};
  }
}

function galaxyFacts(id: Of<"galaxy">["id"], { t, p: { v, r } }: Moment) {
  type FactId =
    | "centre"
    | "lap"
    | "speed"
    | "radial"
    | "vertical"
    | "bar"
    | "width"
    | "mass"
    | "diskWidth"
    | "thickness"
    | "stars"
    | "age";
  const row = (id: FactId, value: string) => ({ id, label: t(`facts.${id}`), value });
  switch (id) {
    case "sun": {
      const c = CATALOGUE.galaxy.sun;
      return [
        row("centre", t("cards.galaxy.sun.centre", { value: v(c.centre) })),
        row("lap", t("cards.galaxy.sun.lap", { value: v(c.lap), range: r(c.lap) })),
        row(
          "speed",
          t("cards.galaxy.sun.speed", { value: v(c.circularSpeed), sun: v(c.sunSpeed) }),
        ),
        row(
          "radial",
          t("cards.galaxy.sun.radial", { value: v(c.radialSwing), period: v(c.radialPeriod) }),
        ),
        row(
          "vertical",
          t("cards.galaxy.sun.vertical", {
            value: v(c.verticalAmplitude),
            period: v(c.verticalPeriod),
            height: v(c.height),
          }),
        ),
      ];
    }
    case "bulge": {
      const c = CATALOGUE.galaxy.bulge;
      return [
        row("centre", t("cards.galaxy.bulge.centre", { value: v(c.centre) })),
        row(
          "bar",
          t("cards.galaxy.bulge.bar", { value: v(c.bar), range: r(c.bar), angle: v(c.barAngle) }),
        ),
      ];
    }
    case "halo":
      return [
        row("width", t("cards.galaxy.halo.width", { value: v(CATALOGUE.galaxy.halo.width) })),
        row("mass", t("cards.galaxy.halo.mass")),
      ];
    case "milkyway": {
      const c = CATALOGUE.galaxy.milkyway;
      return [
        row("diskWidth", t("cards.galaxy.milkyway.diskWidth", { value: v(c.diskWidth) })),
        row("thickness", t("cards.galaxy.milkyway.thickness", { value: v(c.thickness) })),
        row("stars", t("cards.galaxy.milkyway.stars", { value: v(c.stars) })),
        row("age", t("cards.galaxy.milkyway.age", { value: v(c.age) })),
      ];
    }
  }
}

/** Figures in a galaxy card's body and caution. */
function galaxyNotes(id: Of<"galaxy">["id"], { p: { v, r } }: Moment) {
  switch (id) {
    case "sun":
      return { body: { laps: v(CATALOGUE.galaxy.sun.laps) }, caution: {} };
    case "bulge":
      return { body: { mass: v(CATALOGUE.galaxy.bulge.blackHole) }, caution: {} };
    case "halo":
      return { body: {}, caution: {} };
    case "milkyway": {
      const c = CATALOGUE.galaxy.milkyway;
      return {
        body: { bar: v(c.barAngle), pitch: v(c.armPitch), merger: r(c.gaiaEnceladus) },
        caution: { tilt: v(c.planeTilt) },
      };
    }
  }
}

export const NEIGHBOUR_IDS: readonly NeighbourId[] = NEIGHBOURS.map((n) => n.id);

/** 1 au in km and light-minutes, from the science kit's exact definitions. */
function auFigures({ p: { v } }: Moment) {
  const c = CATALOGUE.sun.sun;
  return { au: v(c.au), minutes: v(c.auLightTime) };
}

function sunCard(m: Moment): Card {
  const {
    t,
    p: { v },
  } = m;
  const c = CATALOGUE.sun.sun;
  return {
    badge: t("badges.measured"),
    title: t("cards.sun.title"),
    facts: [
      {
        id: "radius",
        label: t("facts.radius"),
        value: t("cards.sun.radius", { km: v(c.radius), au: v(c.radiusAu) }),
      },
      { id: "age", label: t("facts.age"), value: t("cards.sun.age", { value: v(c.age) }) },
      { id: "au", label: t("facts.oneAu"), value: t("cards.sun.oneAu", auFigures(m)) },
    ],
    body: t("cards.sun.body", { mass: v(c.massShare), spin: v(c.spinShare) }),
    caution: t("cards.sun.caution", { diameters: v(c.earthDiameters) }),
  };
}

/** Figures in a planet's note. */
function planetBody(id: PlanetId, m: Moment) {
  if (id === "earth") return { ...auFigures(m), metres: m.p.v(CATALOGUE.planets.earth.auMetres) };
  if (id === "neptune") return { end: m.p.v(CATALOGUE.planets.neptune.end) };
  return {};
}

function planetCard(sel: Of<"planet">, m: Moment): Card {
  const { t, f, d, p, mig, elliptical, date } = m;
  const id: PlanetId = sel.id;
  const el = planetElements(id, mig, 0, date);
  const now = planetElements(id, 1, 0, date);
  const c: { radius: Value; start?: Value } = CATALOGUE.planets[id];
  const moved = !!c.start && mig < 0.999;
  return {
    badge: moved ? t("badges.endMeasured") : t("badges.measuredRounded"),
    title: t(`names.${id}`),
    facts: [
      ...(moved ? [{ id: "slider", label: t("facts.onSlider"), value: formatAu(t, d, el.a) }] : []),
      { id: "today", label: t("facts.today"), value: formatAu(t, d, now.a) },
      ...(c.start
        ? [
            {
              id: "start",
              label: t("facts.modelStart"),
              value: t("facts.notMeasured", { value: p.v(c.start) }),
            },
          ]
        : []),
      { id: "radius", label: t("facts.radius"), value: t("facts.km", { value: p.v(c.radius) }) },
      ...orbitFacts(t, f, d, el, ["nearFar", "period"]),
    ],
    body: t(`cards.planets.${id}`, planetBody(id, m)),
    caution: elliptical ? t("cards.planetCautionEllipse") : t("cards.planetCautionCircle"),
  };
}

function namedNotes(id: Of<"named">["id"], { p: { v } }: Moment) {
  if (id === "sedna") {
    const c = CATALOGUE.named.sedna;
    return { summary: { near: v(c.perihelion), far: v(c.aphelion) }, caution: {} };
  }
  if (id === "halley")
    return { summary: {}, caution: { a: v(CATALOGUE.named.halley.semiMajorAxis) } };
  return { summary: {}, caution: {} };
}

function namedCard(sel: Of<"named">, m: Moment): Card {
  const { t, f, d, mig, date } = m;
  const el = namedElements(namedById(sel.id), mig, 0, date);
  const notes = namedNotes(sel.id, m);
  return {
    badge: rewinds(sel.id) ? t("badges.rewound") : t("badges.presentOnly"),
    title: t(`names.${sel.id}`),
    facts: [
      { id: "average", label: t("facts.average"), value: formatAu(t, d, el.a) },
      ...orbitFacts(t, f, d, el, ["nearFar", "period"]),
    ],
    body: t(`cards.named.${sel.id}.summary`, notes.summary),
    caution: t(`cards.named.${sel.id}.caution`, notes.caution),
  };
}

function populationCard(sel: Of<"population">, m: Moment): Card {
  const { t } = m;
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
    facts: populationFacts(sel.id, m),
    body: t(`cards.populations.${sel.id}.body`, populationBody(sel.id, m)),
    caution: t(`cards.populations.${sel.id}.caution`),
  };
}

function tracerCard(sel: Of<"tracer">, { t, f, d, p, yearsAgo, mig }: Moment): Card {
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
  const sample = CATALOGUE.populations.tracers;
  const note =
    tr.kind === "cold"
      ? t("cards.tracer.cold", { range: p.r(sample.coldClassicals) })
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
    caution: t("cards.tracer.caution", { count: p.v(sample.count) }),
  };
}

/** Rows and notes of a neighbour's card. */
function starCopy(id: NeighbourId, { t, p: { v, r } }: Moment) {
  const c = CATALOGUE.stars[id];
  const velocity = v(c.radialVelocity);
  const approach = { distance: v(c.distance), approach: v(c.approach), years: v(c.approachWhen) };
  switch (id) {
    case "proxima":
      return {
        where: t("cards.stars.proxima.where"),
        motion: t("cards.stars.proxima.motion", { velocity, proper: v(c.properMotion) }),
        body: {},
      };
    case "alphaCen": {
      const a = CATALOGUE.stars.alphaCen;
      return {
        where: t("cards.stars.alphaCen.where", { separation: v(a.fromProxima) }),
        motion: t("cards.stars.alphaCen.motion", { velocity }),
        body: { ...approach, proxima: v(a.proximaOut) },
      };
    }
    case "barnard":
      return {
        where: t("cards.stars.barnard.where"),
        motion: t("cards.stars.barnard.motion", { velocity, proper: v(c.properMotion) }),
        body: approach,
      };
    case "scholz":
      return {
        where: t("cards.stars.scholz.where", { distance: v(c.distance) }),
        motion: t("cards.stars.scholz.motion", { velocity }),
        body: { flyby: r(CATALOGUE.stars.scholz.flyby) },
      };
  }
}

function starCard(sel: Of<"star">, m: Moment): Card {
  const { t, d, p, yearsAgo } = m;
  const star = NEIGHBOURS.find((s) => s.id === sel.id)!;
  const inWindow = yearsAgo < 3e5;
  const ly = neighbourDistanceLy(star, inWindow ? yearsAgo : 0);
  const c = CATALOGUE.stars[sel.id];
  const copy = starCopy(sel.id, m);
  return {
    badge: inWindow ? t("badges.measuredTrack") : t("badges.measured"),
    title: t(`names.${sel.id}`),
    facts: [
      {
        id: "distance",
        label: inWindow && yearsAgo > 5e4 ? t("facts.onSlider") : t("facts.today"),
        value: formatAu(t, d, ly * LIGHT_YEAR_AU, false),
      },
      { id: "direction", label: t("facts.direction"), value: copy.where },
      { id: "motion", label: t("facts.motion"), value: copy.motion },
      {
        id: "closest",
        label: t("facts.closest"),
        value: t(closestApproach(star).yearsAgo > 0 ? "facts.closestPast" : "facts.closestFuture", {
          distance: p.v(c.approach),
          years: p.v(c.approachWhen),
        }),
      },
    ],
    body: t(`cards.stars.${sel.id}.body`, copy.body),
    caution: t("cards.stars.caution"),
  };
}

function galaxyCard(sel: Of<"galaxy">, m: Moment): Card {
  const { t } = m;
  const notes = galaxyNotes(sel.id, m);
  const badge =
    sel.id === "sun"
      ? t("badges.schematic")
      : sel.id === "halo"
        ? t("badges.inferred")
        : t("badges.sketch");
  return {
    badge,
    title: t(`cards.galaxy.${sel.id}.title`),
    facts: galaxyFacts(sel.id, m),
    body: t(`cards.galaxy.${sel.id}.body`, notes.body),
    caution: t(`cards.galaxy.${sel.id}.caution`, notes.caution),
  };
}

/**
 * A structure beyond the Galaxy at the slider's moment: distances and sizes that change with
 * time are computed from the model, and the scale of space is shown once it differs.
 */
function cosmosCard(sel: Of<"cosmos">, { t, f, p, yearsAgo }: Moment): Card {
  const { v, r, live } = p;
  type FactId =
    | "width"
    | "members"
    | "mass"
    | "apart"
    | "distance"
    | "approach"
    | "future"
    | "heart"
    | "where"
    | "depth"
    | "motion"
    | "scaleThen";
  const fact = (id: FactId, value: string) => ({ id, label: t(`facts.${id}`), value });
  const key = `cards.cosmos.${sel.id}` as const;
  const scale = CATALOGUE.cosmos.universe.scale.at(yearsAgo);
  const then =
    yearsAgo >= 1e7
      ? [
          fact(
            "scaleThen",
            t("cards.cosmos.scaleThen", { value: f.number(scale, { style: "percent" }) }),
          ),
        ]
      : [];
  const {
    facts,
    body = {},
    caution = {},
  } = ((): {
    facts: ReturnType<typeof fact>[];
    body?: Record<string, string>;
    caution?: Record<string, string>;
  } => {
    switch (sel.id) {
      case "localGroup": {
        const c = CATALOGUE.cosmos.localGroup;
        return {
          facts: [
            fact("width", t("cards.cosmos.localGroup.width", { value: v(c.width) })),
            fact("members", t("cards.cosmos.localGroup.members", { value: v(c.members) })),
            fact("mass", t("cards.cosmos.localGroup.mass")),
            fact("apart", live(c.apart)),
          ],
          body: { turnaround: v(c.turnaround), turnaroundAgo: v(c.turnaroundAgo) },
        };
      }
      case "localSheet": {
        const c = CATALOGUE.cosmos.localSheet;
        return {
          facts: [
            fact("width", t("cards.cosmos.localSheet.width", { value: live(c.width) })),
            fact("depth", t("cards.cosmos.localSheet.thickness", { value: v(c.thickness) })),
            fact("members", t("cards.cosmos.localSheet.members")),
            fact(
              "motion",
              t("cards.cosmos.localSheet.motion", { value: v(c.fromVoid), stray: v(c.stray) }),
            ),
            ...then,
          ],
          body: { radius: v(c.radius) },
        };
      }
      case "andromeda": {
        const c = CATALOGUE.cosmos.andromeda;
        return {
          facts: [
            fact("distance", live(c.distance)),
            fact(
              "approach",
              t("cards.cosmos.andromeda.approach", {
                value: v(c.approach),
                sun: v(c.approachSun),
              }),
            ),
            fact("width", t("cards.cosmos.andromeda.width", { range: r(c.width) })),
            fact("future", t("cards.cosmos.andromeda.future", { range: r(c.firstPass) })),
          ],
          body: { sun: v(c.approachSun), approach: v(c.approach), distance: v(c.distance) },
          caution: { within: v(c.mergerWithin) },
        };
      }
      case "virgo": {
        const c = CATALOGUE.cosmos.virgo;
        return {
          facts: [
            fact("distance", live(c.distance)),
            fact(
              "members",
              t("cards.cosmos.virgo.members", { value: v(c.members), range: r(c.members) }),
            ),
            fact("width", t("cards.cosmos.virgo.width", { value: v(c.width) })),
            fact("heart", t("cards.cosmos.virgo.heart", { value: v(c.blackHole) })),
            ...then,
          ],
        };
      }
      case "supercluster": {
        const c = CATALOGUE.cosmos.supercluster;
        return {
          facts: [
            fact("width", t("cards.cosmos.supercluster.width", { value: live(c.width) })),
            fact("members", t("cards.cosmos.supercluster.members", { value: v(c.members) })),
            fact("heart", t("cards.cosmos.supercluster.heart")),
            ...then,
          ],
        };
      }
      case "laniakea": {
        const c = CATALOGUE.cosmos.laniakea;
        return {
          facts: [
            fact("width", t("cards.cosmos.laniakea.width", { value: live(c.width) })),
            fact("members", t("cards.cosmos.laniakea.members", { value: v(c.members) })),
            fact("mass", t("cards.cosmos.laniakea.mass", { value: v(c.mass) })),
            fact("heart", t("cards.cosmos.laniakea.heart", { value: v(c.heart) })),
            ...then,
          ],
        };
      }
      case "triangulum": {
        const c = CATALOGUE.cosmos.triangulum;
        return {
          facts: [
            fact("distance", live(c.distance)),
            fact("width", t("cards.cosmos.triangulum.width", { value: v(c.width) })),
            fact("future", t("cards.cosmos.triangulum.future")),
          ],
        };
      }
      case "fornax": {
        const c = CATALOGUE.cosmos.fornax;
        return {
          facts: [
            fact("distance", live(c.distance)),
            fact("members", t("cards.cosmos.fornax.members", { value: v(c.members) })),
            fact("width", t("cards.cosmos.fornax.width", { value: v(c.width) })),
            fact("heart", t("cards.cosmos.fornax.heart")),
            ...then,
          ],
        };
      }
      case "centaurus":
        return {
          facts: [
            fact("distance", live(CATALOGUE.cosmos.centaurus.distance)),
            fact("members", t("cards.cosmos.centaurus.members")),
            fact("heart", t("cards.cosmos.centaurus.heart")),
            ...then,
          ],
        };
      case "hydra": {
        const c = CATALOGUE.cosmos.hydra;
        return {
          facts: [
            fact("distance", live(c.distance)),
            fact("members", t("cards.cosmos.hydra.members", { value: v(c.members) })),
            fact("heart", t("cards.cosmos.hydra.heart")),
            ...then,
          ],
        };
      }
      case "greatAttractor": {
        const c = CATALOGUE.cosmos.greatAttractor;
        return {
          facts: [
            fact("distance", live(c.distance)),
            fact("where", t("cards.cosmos.greatAttractor.where")),
            fact("mass", t("cards.cosmos.greatAttractor.mass", { value: v(c.mass) })),
            fact("heart", t("cards.cosmos.greatAttractor.heart")),
            ...then,
          ],
          body: { distance: v(c.distance) },
        };
      }
    }
  })();
  return {
    badge:
      sel.id === "supercluster" || sel.id === "laniakea" ? t("badges.sketch") : t("badges.mixed"),
    title: t(`${key}.title`),
    facts,
    body: t(`${key}.body`, body),
    caution: t(`${key}.caution`, caution),
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
    p: {
      v: (fact) => figure(t, d, fact),
      r: (fact) => span(t, d, fact),
      live: (fact) => figureAt(t, d, fact, yearsAgo),
    },
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
    case "cosmos":
      return cosmosCard(sel, m);
  }
}

export const NAMED_IDS = NAMED.map((body) => body.id);
