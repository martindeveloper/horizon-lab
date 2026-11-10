/**
 * Dated moments the clock can be set to, found in the model rather than typed: each is a root
 * of a function of the date on the shared orbits (`planetElements`, `namedElements`): a planet
 * at opposition, two planets in conjunction as seen from Earth, a body at perihelion or
 * aphelion, Mercury crossing the Sun's disc. A coarse scan from today brackets the next (or
 * last) sign change, a bisection narrows it to the hour. That is the search's step, not the
 * dates' accuracy: on approximate elements a moment can fall about a day from the almanac's
 * (the slow Jupiter–Saturn conjunction does). The orbits are the JPL fit, good for
 * 1800–2050: a date further out is where that fit carries, marked `extrapolated`.
 */
import { barycentreOffset, isBarycentreHost } from "@/space/solar-system/model/barycentre";
import { namedElements, planetElements } from "@/space/solar-system/model/elements";
import type { SolarSelection } from "@/space/solar-system/model/selection";
import type { SolarViewId } from "@/space/solar-system/model/views";
import {
  DAYS_PER_JULIAN_YEAR,
  keplerPosition,
  namedById,
  type NamedId,
  type PlanetId,
  type Vec3,
} from "@horizon/toolkit/bodies";
import { wrapSigned } from "@horizon/toolkit/math";
import { RAD_PER_DEG } from "@horizon/toolkit/science";

type BodyRef = { kind: "planet"; id: PlanetId } | { kind: "named"; id: NamedId };

export type EventKind = "opposition" | "conjunction" | "perihelion" | "aphelion" | "transit";

/** What to look for, and whether the moment wanted is the next one or the last. */
type Spec = {
  id: string;
  kind: EventKind;
  bodies: readonly [BodyRef] | readonly [BodyRef, BodyRef];
  when: "next" | "last";
  /** The view the moment is best seen in. */
  view: SolarViewId;
};

export type SolarEvent = {
  id: string;
  kind: EventKind;
  /** The bodies the moment is about; the first is selected. */
  bodies: readonly SolarSelection[];
  date: Date;
  /** Years from `now`, negative for a moment gone by: the Motion clock's offset. */
  years: number;
  view: SolarViewId;
  /** Past the JPL fit's 2050: the orbits carried on as they are today. */
  extrapolated: boolean;
};

const planet = (id: PlanetId): BodyRef => ({ kind: "planet", id });
const named = (id: NamedId): BodyRef => ({ kind: "named", id });

const SPECS: readonly Spec[] = [
  {
    id: "earth-perihelion",
    kind: "perihelion",
    bodies: [planet("earth")],
    when: "next",
    view: "inner",
  },
  {
    id: "mars-opposition",
    kind: "opposition",
    bodies: [planet("mars")],
    when: "next",
    view: "inner",
  },
  {
    id: "mercury-transit",
    kind: "transit",
    bodies: [planet("mercury")],
    when: "next",
    view: "inner",
  },
  {
    id: "jupiter-opposition",
    kind: "opposition",
    bodies: [planet("jupiter")],
    when: "next",
    view: "giants",
  },
  {
    id: "saturn-opposition",
    kind: "opposition",
    bodies: [planet("saturn")],
    when: "next",
    view: "giants",
  },
  {
    id: "great-conjunction-last",
    kind: "conjunction",
    bodies: [planet("jupiter"), planet("saturn")],
    when: "last",
    view: "giants",
  },
  {
    id: "great-conjunction",
    kind: "conjunction",
    bodies: [planet("jupiter"), planet("saturn")],
    when: "next",
    view: "giants",
  },
  {
    id: "ceres-perihelion",
    kind: "perihelion",
    bodies: [named("ceres")],
    when: "next",
    view: "inner",
  },
  {
    id: "halley-perihelion",
    kind: "perihelion",
    bodies: [named("halley")],
    when: "next",
    view: "inner",
  },
  {
    id: "sedna-perihelion",
    kind: "perihelion",
    bodies: [named("sedna")],
    when: "next",
    view: "scattered",
  },
];

const MS_PER_DAY = 86_400_000;
const MS_PER_YEAR = DAYS_PER_JULIAN_YEAR * MS_PER_DAY;
/** How far the search looks either way, years. */
const REACH_YEARS = 120;
/** The JPL fit's last year; beyond it the orbits are carried on as they are. */
const FIT_END = Date.UTC(2050, 0, 1);
/** The Sun's disc seen from Earth, degrees: a transit needs Mercury within it at conjunction. */
const SUN_HALF_DEG = 0.267;
/** A bracket narrows to this before the date is taken. */
const PRECISION_MS = 3_600_000;

/** A body's heliocentric position at a date, scene frame, au; a fresh array, as a search compares several. */
function positionOf(body: BodyRef, date: Date): Vec3 {
  const el =
    body.kind === "planet"
      ? planetElements(body.id, 1, 0, date)
      : namedElements(namedById(body.id), 1, 0, date);
  return keplerPosition(el);
}

const swing: Vec3 = [0, 0, 0];

/**
 * The body's own centre: where the elements place a system's barycentre (Earth's, Pluto's),
 * its moon's swing is added. A longitude moves by seconds of arc for it and is read off the
 * orbit; a distance turns where the swing says, Earth's perihelion up to a day and a half
 * from its barycentre's.
 */
function centreOf(body: BodyRef, date: Date): Vec3 {
  const at = positionOf(body, date);
  if (isBarycentreHost(body.id)) {
    barycentreOffset(body.id, date, swing);
    at[0] += swing[0];
    at[1] += swing[1];
    at[2] += swing[2];
  }
  return at;
}
/** Ecliptic longitude, degrees, of a scene-frame position (X to the equinox, Y north, Z = −y). */
const longitude = (p: Vec3) => Math.atan2(-p[2], p[0]) / RAD_PER_DEG;
const latitude = (p: Vec3) => Math.atan2(p[1], Math.hypot(p[0], p[2])) / RAD_PER_DEG;
const distance = (p: Vec3) => Math.hypot(p[0], p[1], p[2]);
const diff = (a: number, b: number) => wrapSigned(a - b, 360);

/** The function of the date that crosses zero at the moment, and the step the scan takes, ms. */
function rootOf(spec: Spec): {
  f: (ms: number) => number;
  step: number;
  accept?: (ms: number) => boolean;
} {
  const [first, second] = spec.bodies;
  const earth = planet("earth");
  switch (spec.kind) {
    case "opposition":
      /* Earth overtakes the planet: their heliocentric longitudes meet, Earth's rising past. */
      return {
        f: (ms) =>
          diff(
            longitude(positionOf(earth, new Date(ms))),
            longitude(positionOf(first, new Date(ms))),
          ),
        step: 2 * MS_PER_DAY,
      };
    case "conjunction": {
      /* As seen from Earth: the two planets' geocentric longitudes meet, the inner one (first)
         rising past the outer. */
      const seen = (body: BodyRef, ms: number) => {
        const p = positionOf(body, new Date(ms));
        const e = positionOf(earth, new Date(ms));
        return longitude([p[0] - e[0], p[1] - e[1], p[2] - e[2]]);
      };
      return { f: (ms) => diff(seen(first, ms), seen(second!, ms)), step: 2 * MS_PER_DAY };
    }
    case "transit": {
      /* Inferior conjunction (the planet retrograde, the Sun's longitude rising past it), with
         the planet inside the Sun's disc. */
      const seen = (ms: number) => {
        const p = positionOf(first, new Date(ms));
        const e = positionOf(earth, new Date(ms));
        return [p[0] - e[0], p[1] - e[1], p[2] - e[2]] as Vec3;
      };
      return {
        f: (ms) => diff(longitude(positionOf(earth, new Date(ms))) + 180, longitude(seen(ms))),
        step: MS_PER_DAY,
        accept: (ms) => Math.abs(latitude(seen(ms))) < SUN_HALF_DEG,
      };
    }
    case "perihelion":
    case "aphelion": {
      /* The distance's rate of change turns: upward at perihelion, downward at aphelion. */
      const period =
        first.kind === "named"
          ? (() => {
              const el = namedElements(namedById(first.id), 1, 0, new Date(0));
              return Math.sqrt(el.a ** 3) * MS_PER_YEAR;
            })()
          : MS_PER_YEAR;
      const h = Math.max(MS_PER_DAY, period / 4000);
      const sign = spec.kind === "perihelion" ? 1 : -1;
      return {
        f: (ms) =>
          sign *
          (distance(centreOf(first, new Date(ms + h))) -
            distance(centreOf(first, new Date(ms - h)))),
        step: Math.max(MS_PER_DAY, period / 400),
      };
    }
  }
}

/**
 * The root nearest `from` in the direction asked, ms: a scan brackets a crossing of `f` from
 * negative to positive (looking forward; the reverse looking back), a bisection narrows it. A
 * crossing `accept` turns down is passed over. Null when none lies within reach.
 */
function findRoot(
  { f, step, accept }: ReturnType<typeof rootOf>,
  from: number,
  forward: boolean,
): number | null {
  const dir = forward ? 1 : -1;
  let t0 = from;
  let f0 = f(t0);
  for (let n = 0; n * step < REACH_YEARS * MS_PER_YEAR; n += 1) {
    const t1 = t0 + dir * step;
    const f1 = f(t1);
    /* Rising through zero in time order, and not a wrap of the angle's branch. */
    const lo = forward ? f0 : f1;
    const hi = forward ? f1 : f0;
    if (lo < 0 && hi >= 0 && hi - lo < 180) {
      let a = Math.min(t0, t1);
      let b = Math.max(t0, t1);
      while (b - a > PRECISION_MS) {
        const m = (a + b) / 2;
        if (f(m) < 0) a = m;
        else b = m;
      }
      const root = (a + b) / 2;
      if (!accept || accept(root)) return root;
    }
    t0 = t1;
    f0 = f1;
  }
  return null;
}

const selectionOf = (body: BodyRef): SolarSelection => body;

/** The moments around `now`, dated, in time order; one that lies out of reach is left out. */
export function solarEvents(now: Date): SolarEvent[] {
  const events: SolarEvent[] = [];
  for (const spec of SPECS) {
    const ms = findRoot(rootOf(spec), now.getTime(), spec.when === "next");
    if (ms === null) continue;
    const date = new Date(ms);
    events.push({
      id: spec.id,
      kind: spec.kind,
      bodies: spec.bodies.map(selectionOf),
      date,
      years: (ms - now.getTime()) / MS_PER_YEAR,
      view: spec.view,
      extrapolated: ms > FIT_END,
    });
  }
  return events.sort((a, b) => a.date.getTime() - b.date.getTime());
}

/**
 * The clock's date for a Motion offset: today plus `years` Julian years. Null past the
 * calendar's reach: a JavaScript date ends a hundred million days from 1970, some 270,000
 * years either way, and beyond it only the offset can be told.
 */
export function clockDate(now: Date, years: number): Date | null {
  const date = new Date(now.getTime() + years * MS_PER_YEAR);
  return Number.isNaN(date.getTime()) ? null : date;
}
