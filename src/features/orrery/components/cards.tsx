import { NAMED, namedById, type PlanetId } from "@horizon/toolkit/bodies";
import { LIGHT_YEAR_AU } from "@horizon/toolkit/science";

import { CATALOGUE, type Fact } from "../lib/model/catalogue";
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
  formatAu,
  formatYearsAgo,
  orbitFacts,
  quantity,
  type DistanceSettings,
  type QuantityOptions,
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

function populationFacts(id: Of<"population">["id"], { t, d }: Moment) {
  const q = (fact: Fact) => quantity(t, d, fact);
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
      const c = CATALOGUE.populations.asteroids.facts;
      return [
        row("where", t("cards.populations.asteroids.where", q(c.where))),
        row("mass", t("cards.populations.asteroids.mass", q(c.mass))),
      ];
    }
    case "disk":
      return [
        row(
          "drawnAt",
          t("cards.populations.disk.drawnAt", q(CATALOGUE.populations.disk.facts.drawnAt)),
        ),
        row("when", t("cards.populations.disk.when")),
      ];
    case "kuiper": {
      const c = CATALOGUE.populations.kuiper.facts;
      return [
        row("region", t("cards.populations.kuiper.region", q(c.region))),
        row("todayMass", t("cards.populations.kuiper.todayMass", q(c.todayMass))),
        row("originalMass", t("cards.populations.kuiper.originalMass", q(c.originalMass))),
      ];
    }
    case "scattered":
      return [
        row("shape", t("cards.populations.scattered.shape")),
        row("reach", t("cards.populations.scattered.reach")),
      ];
    case "oort": {
      const c = CATALOGUE.populations.oort.facts;
      return [
        row("innerEdge", t("cards.populations.oort.innerEdge", q(c.innerEdge))),
        row("outerEdge", t("cards.populations.oort.outerEdge", q(c.outerEdge))),
        row(
          "shells",
          t("cards.populations.oort.shells", {
            inner: q(c.innerShell).value,
            outer: q(c.outerShell).value,
          }),
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
function populationBody(id: Of<"population">["id"], { t, d }: Moment) {
  const q = (fact: Fact) => quantity(t, d, fact);
  switch (id) {
    case "disk":
      return { mass: q(CATALOGUE.populations.disk.facts.mass).value };
    case "kuiper": {
      const c = CATALOGUE.populations.kuiper.facts;
      return {
        catalogued: q(c.catalogued).value,
        cliff: q(c.cliff).value,
        cold: q(c.coldClassicals).range,
        plutinos: q(c.plutinos).value,
      };
    }
    default:
      return {};
  }
}

function galaxyFacts(id: Of<"galaxy">["id"], { t, d }: Moment) {
  const q = (fact: Fact, options?: QuantityOptions) => quantity(t, d, fact, options);
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
      const c = CATALOGUE.galaxy.sun.facts;
      return [
        row("centre", t("cards.galaxy.sun.centre", q(c.centre))),
        row("lap", t("cards.galaxy.sun.lap", q(c.lap, { in: "Myr" }))),
        row(
          "speed",
          t("cards.galaxy.sun.speed", {
            value: q(c.circularSpeed).value,
            sun: q(c.sunSpeed).value,
          }),
        ),
        row(
          "radial",
          t("cards.galaxy.sun.radial", {
            value: q(c.radialSwing).value,
            period: q(c.radialPeriod, { in: "Myr" }).value,
          }),
        ),
        row(
          "vertical",
          t("cards.galaxy.sun.vertical", {
            value: q(c.verticalAmplitude).value,
            period: q(c.verticalPeriod, { in: "Myr" }).value,
            height: q(c.height).value,
          }),
        ),
      ];
    }
    case "bulge": {
      const c = CATALOGUE.galaxy.bulge.facts;
      return [
        row("centre", t("cards.galaxy.bulge.centre", q(c.centre))),
        row("bar", t("cards.galaxy.bulge.bar", { ...q(c.bar), angle: q(c.barAngle).value })),
      ];
    }
    case "halo":
      return [
        row("width", t("cards.galaxy.halo.width", q(CATALOGUE.galaxy.halo.facts.width))),
        row("mass", t("cards.galaxy.halo.mass")),
      ];
    case "milkyway": {
      const c = CATALOGUE.galaxy.milkyway.facts;
      return [
        row("diskWidth", t("cards.galaxy.milkyway.diskWidth", q(c.diskWidth))),
        row("thickness", t("cards.galaxy.milkyway.thickness", q(c.thickness))),
        row("stars", t("cards.galaxy.milkyway.stars", q(c.stars, { scale: 1e9 }))),
        row("age", t("cards.galaxy.milkyway.age", q(c.age))),
      ];
    }
  }
}

/** Figures in a galaxy card's body and caution. */
function galaxyNotes(id: Of<"galaxy">["id"], { t, d }: Moment) {
  const q = (fact: Fact, options?: QuantityOptions) => quantity(t, d, fact, options).value;
  switch (id) {
    case "sun":
      return { body: { laps: q(CATALOGUE.galaxy.sun.facts.laps) }, caution: {} };
    case "bulge":
      return {
        body: { mass: q(CATALOGUE.galaxy.bulge.facts.blackHole, { scale: 1e6 }) },
        caution: {},
      };
    case "halo":
      return { body: {}, caution: {} };
    case "milkyway": {
      const c = CATALOGUE.galaxy.milkyway.facts;
      return {
        body: {
          bar: q(c.barAngle),
          pitch: q(c.armPitch),
          merger: quantity(t, d, c.gaiaEnceladus).range,
        },
        caution: { tilt: q(c.planeTilt) },
      };
    }
  }
}

export const NEIGHBOUR_IDS: readonly NeighbourId[] = NEIGHBOURS.map((n) => n.id);

function sunCard({ t, d }: Moment): Card {
  const q = (fact: Fact, options?: QuantityOptions) => quantity(t, d, fact, options).value;
  const c = CATALOGUE.sun.sun.facts;
  return {
    badge: t("badges.measured"),
    title: t("cards.sun.title"),
    facts: [
      {
        id: "radius",
        label: t("facts.radius"),
        value: t("cards.sun.radius", { km: q(c.radius), au: q(c.radius, { in: "au", digits: 2 }) }),
      },
      {
        id: "age",
        label: t("facts.age"),
        value: t("cards.sun.age", { value: q(c.age, { in: "Gyr" }) }),
      },
      { id: "au", label: t("facts.oneAu"), value: t("cards.sun.oneAu", auFigures(t, d)) },
    ],
    body: t("cards.sun.body", { mass: q(c.massShare), spin: q(c.spinShare) }),
    caution: t("cards.sun.caution", { diameters: q(c.earthDiameters) }),
  };
}

/** 1 au in million km and light-minutes, from the science kit's exact definitions. */
function auFigures(t: Translate, d: DistanceSettings) {
  const c = CATALOGUE.sun.sun.facts;
  return {
    millions: quantity(t, d, c.au, { scale: 1e6, digits: 4 }).value,
    minutes: quantity(t, d, c.auLightTime, { in: "min", digits: 2 }).value,
  };
}

/** Figures in a planet's note. */
function planetBody(id: PlanetId, t: Translate, d: DistanceSettings) {
  if (id === "earth")
    return {
      ...auFigures(t, d),
      metres: quantity(t, d, CATALOGUE.planets.earth.facts.auMetres).value,
    };
  if (id === "neptune") return { end: quantity(t, d, CATALOGUE.planets.neptune.facts.end).value };
  return {};
}

function planetCard(sel: Of<"planet">, { t, f, d, mig, elliptical, date }: Moment): Card {
  const id: PlanetId = sel.id;
  const el = planetElements(id, mig, 0, date);
  const now = planetElements(id, 1, 0, date);
  const c: { radius: Fact; start?: Fact } = CATALOGUE.planets[id].facts;
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
              value: t("facts.notMeasured", { value: quantity(t, d, c.start).value }),
            },
          ]
        : []),
      {
        id: "radius",
        label: t("facts.radius"),
        value: t("facts.km", { value: quantity(t, d, c.radius).value }),
      },
      ...orbitFacts(t, f, d, el, ["nearFar", "period"]),
    ],
    body: t(`cards.planets.${id}`, planetBody(id, t, d)),
    caution: elliptical ? t("cards.planetCautionEllipse") : t("cards.planetCautionCircle"),
  };
}

function namedNotes(id: Of<"named">["id"], t: Translate, d: DistanceSettings) {
  const q = (fact: Fact) => quantity(t, d, fact).value;
  if (id === "sedna") {
    const c = CATALOGUE.named.sedna.facts;
    return { summary: { near: q(c.perihelion), far: q(c.aphelion) }, caution: {} };
  }
  if (id === "halley")
    return { summary: {}, caution: { a: q(CATALOGUE.named.halley.facts.semiMajorAxis) } };
  return { summary: {}, caution: {} };
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
    body: t(`cards.named.${sel.id}.summary`, namedNotes(sel.id, t, d).summary),
    caution: t(`cards.named.${sel.id}.caution`, namedNotes(sel.id, t, d).caution),
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
  const sample = CATALOGUE.tracers.sample.facts;
  const note =
    tr.kind === "cold"
      ? t("cards.tracer.cold", { range: quantity(t, d, sample.coldClassicals).range })
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
    caution: t("cards.tracer.caution", { count: quantity(t, d, sample.count).value }),
  };
}

/** Rows and notes of a neighbour's card, from the catalogue. */
function starCopy(id: NeighbourId, { t, d }: Moment) {
  const q = (fact: Fact, options?: QuantityOptions) => quantity(t, d, fact, options).value;
  const c = CATALOGUE.stars[id].facts;
  const velocity = q(c.radialVelocity);
  switch (id) {
    case "proxima":
      return {
        where: t("cards.stars.proxima.where"),
        motion: t("cards.stars.proxima.motion", {
          velocity,
          proper: q(c.properMotion, { in: "arcsec/yr", digits: 2 }),
        }),
        body: {},
      };
    case "alphaCen": {
      const a = CATALOGUE.stars.alphaCen.facts;
      return {
        where: t("cards.stars.alphaCen.where", { separation: q(a.fromProxima) }),
        motion: t("cards.stars.alphaCen.motion", { velocity }),
        body: {
          distance: q(c.distance),
          proxima: q(a.proximaOut),
          approach: q(c.approach, { digits: 2 }),
          years: q(c.approachWhen, { digits: 2 }),
        },
      };
    }
    case "barnard":
      return {
        where: t("cards.stars.barnard.where"),
        motion: t("cards.stars.barnard.motion", {
          velocity,
          proper: q(c.properMotion, { in: "arcsec/yr", digits: 3 }),
        }),
        body: {
          distance: q(c.distance),
          approach: q(c.approach, { digits: 2 }),
          years: q(c.approachWhen, { digits: 1 }),
        },
      };
    case "scholz":
      return {
        where: t("cards.stars.scholz.where", { distance: q(c.distance, { digits: 2 }) }),
        motion: t("cards.stars.scholz.motion", { velocity }),
        body: {
          flyby: quantity(t, d, CATALOGUE.stars.scholz.facts.flyby, { in: "kyr" }).range,
        },
      };
  }
}

function starCard(sel: Of<"star">, m: Moment): Card {
  const { t, d, yearsAgo } = m;
  const star = NEIGHBOURS.find((s) => s.id === sel.id)!;
  const inWindow = yearsAgo < 3e5;
  const ly = neighbourDistanceLy(star, inWindow ? yearsAgo : 0);
  const c = CATALOGUE.stars[sel.id].facts;
  const pastApproach = closestApproach(star).yearsAgo > 0;
  /* Whole thousands of years, however many digits that takes. */
  const kyr = c.approachWhen.value / 1e3;
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
        value: t(pastApproach ? "facts.closestPast" : "facts.closestFuture", {
          distance: quantity(t, d, c.approach).value,
          years: quantity(t, d, c.approachWhen, {
            in: "kyr",
            digits: Math.max(1, Math.floor(Math.log10(Math.max(kyr, 1))) + 1),
          }).value,
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
function cosmosCard(sel: Of<"cosmos">, { t, f, d, yearsAgo }: Moment): Card {
  const q = (fact: Fact, options?: QuantityOptions) => quantity(t, d, fact, options);
  /* Figures that follow the slider. */
  const now = (fact: Fact) => q(fact, { yearsAgo }).value;
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
  const scale = CATALOGUE.cosmos.universe.facts.scale.at(yearsAgo);
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
        const c = CATALOGUE.cosmos.localGroup.facts;
        return {
          facts: [
            fact("width", t("cards.cosmos.localGroup.width", q(c.width))),
            fact("members", t("cards.cosmos.localGroup.members", q(c.members))),
            fact("mass", t("cards.cosmos.localGroup.mass")),
            fact("apart", now(c.apart)),
          ],
          body: {
            turnaround: q(c.turnaround).value,
            turnaroundAgo: q(c.turnaroundAgo, { in: "Gyr" }).value,
          },
        };
      }
      case "localSheet": {
        const c = CATALOGUE.cosmos.localSheet.facts;
        return {
          facts: [
            fact("width", t("cards.cosmos.localSheet.width", { value: now(c.width) })),
            fact("depth", t("cards.cosmos.localSheet.thickness", q(c.thickness))),
            fact("members", t("cards.cosmos.localSheet.members")),
            fact(
              "motion",
              t("cards.cosmos.localSheet.motion", {
                value: q(c.fromVoid).value,
                stray: q(c.stray).value,
              }),
            ),
            ...then,
          ],
          body: { radius: q(c.radius).value },
        };
      }
      case "andromeda": {
        const c = CATALOGUE.cosmos.andromeda.facts;
        return {
          facts: [
            fact("distance", now(c.distance)),
            fact(
              "approach",
              t("cards.cosmos.andromeda.approach", {
                value: q(c.approach).value,
                sun: q(c.approachSun).value,
              }),
            ),
            fact("width", t("cards.cosmos.andromeda.width", q(c.width))),
            fact("future", t("cards.cosmos.andromeda.future", q(c.firstPass))),
          ],
          body: {
            sun: q(c.approachSun).value,
            approach: q(c.approach).value,
            distance: q(c.distance).value,
          },
          caution: { within: q(c.mergerWithin).value },
        };
      }
      case "virgo": {
        const c = CATALOGUE.cosmos.virgo.facts;
        return {
          facts: [
            fact("distance", now(c.distance)),
            fact("members", t("cards.cosmos.virgo.members", q(c.members))),
            fact("width", t("cards.cosmos.virgo.width", q(c.width))),
            fact("heart", t("cards.cosmos.virgo.heart", q(c.blackHole, { scale: 1e9 }))),
            ...then,
          ],
        };
      }
      case "supercluster": {
        const c = CATALOGUE.cosmos.supercluster.facts;
        return {
          facts: [
            fact("width", t("cards.cosmos.supercluster.width", { value: now(c.width) })),
            fact("members", t("cards.cosmos.supercluster.members", q(c.members))),
            fact("heart", t("cards.cosmos.supercluster.heart")),
            ...then,
          ],
        };
      }
      case "laniakea": {
        const c = CATALOGUE.cosmos.laniakea.facts;
        return {
          facts: [
            fact("width", t("cards.cosmos.laniakea.width", { value: now(c.width) })),
            fact("members", t("cards.cosmos.laniakea.members", q(c.members))),
            fact("mass", t("cards.cosmos.laniakea.mass", q(c.mass))),
            fact("heart", t("cards.cosmos.laniakea.heart", q(c.heart))),
            ...then,
          ],
        };
      }
      case "triangulum": {
        const c = CATALOGUE.cosmos.triangulum.facts;
        return {
          facts: [
            fact("distance", now(c.distance)),
            fact("width", t("cards.cosmos.triangulum.width", q(c.width))),
            fact("future", t("cards.cosmos.triangulum.future")),
          ],
        };
      }
      case "fornax": {
        const c = CATALOGUE.cosmos.fornax.facts;
        return {
          facts: [
            fact("distance", now(c.distance)),
            fact("members", t("cards.cosmos.fornax.members", q(c.members))),
            fact("width", t("cards.cosmos.fornax.width", q(c.width))),
            fact("heart", t("cards.cosmos.fornax.heart")),
            ...then,
          ],
        };
      }
      case "centaurus":
        return {
          facts: [
            fact("distance", now(CATALOGUE.cosmos.centaurus.facts.distance)),
            fact("members", t("cards.cosmos.centaurus.members")),
            fact("heart", t("cards.cosmos.centaurus.heart")),
            ...then,
          ],
        };
      case "hydra": {
        const c = CATALOGUE.cosmos.hydra.facts;
        return {
          facts: [
            fact("distance", now(c.distance)),
            fact("members", t("cards.cosmos.hydra.members", q(c.members))),
            fact("heart", t("cards.cosmos.hydra.heart")),
            ...then,
          ],
        };
      }
      case "greatAttractor": {
        const c = CATALOGUE.cosmos.greatAttractor.facts;
        return {
          facts: [
            fact("distance", now(c.distance)),
            fact("where", t("cards.cosmos.greatAttractor.where")),
            fact("mass", t("cards.cosmos.greatAttractor.mass", q(c.mass))),
            fact("heart", t("cards.cosmos.greatAttractor.heart")),
            ...then,
          ],
          body: { distance: q(c.distance).value },
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
    case "cosmos":
      return cosmosCard(sel, m);
  }
}

export const NAMED_IDS = NAMED.map((body) => body.id);
