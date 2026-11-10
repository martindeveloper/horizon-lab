/**
 * The worlds to stand on and the planets the giant reaches. Each orbit is the body's mean
 * distance today (the JPL elements), widened as the Sun loses mass with the orbit's angular
 * momentum kept; a world is lost when the Sun's radius reaches its orbit, and the inner planets
 * sooner, when Schröder & Smith's (2008) tides and drag pull them in: the sketch has no tides,
 * so their times are the paper's. Earth is the one the copy must name: by radius alone its
 * widened orbit escapes, yet the tides take it half a million years before the tip.
 */
import { literatureFact } from "@/lib/facts";
import type { SurfaceSelection } from "@/space/solar-system/model/selection";
import { jplElements } from "@horizon/toolkit/bodies";
import { recordFrom } from "@horizon/toolkit/records";

import {
  angularSize,
  equilibriumTemperature,
  orbitWidening,
  orbitalPeriod,
  sunlightShare,
} from "./equations";
import { sunAt } from "./sun";
import {
  EARTH_ENGULFED_BEFORE_TIP,
  MERCURY_BEFORE_EARTH,
  MS_END,
  RGB_TIP,
  VENUS_BEFORE_EARTH,
} from "./track";

/** The worlds a visitor orbits, in order from the Sun: each has a measured map in the toolkit. */
export const WORLD_IDS = ["earth", "mars", "europa", "enceladus", "pluto"] as const;
export type WorldId = (typeof WORLD_IDS)[number];

/** Each world's Bond albedo: the share of all the sunlight it reflects, the rest warming it. */
export const BOND_ALBEDO = {
  earth: literatureFact(0.294, "ratio", "nssdc", "verified", { digits: 3 }),
  mars: literatureFact(0.25, "ratio", "nssdc", "verified", { digits: 2 }),
  europa: literatureFact(0.64, "ratio", "lange2026", "verified", {
    range: [0.58, 0.7],
    digits: 2,
  }),
  enceladus: literatureFact(0.81, "ratio", "howett2010", "verified", { digits: 2 }),
  pluto: literatureFact(0.72, "ratio", "buratti2017", "verified", {
    range: [0.65, 0.79],
    digits: 2,
  }),
} as const;

/** The planets the swelling Sun reaches, in order: the map watches them. */
export const INNER_IDS = ["mercury", "venus", "earth"] as const;

/** Whose orbit a world rides: a moon's is its planet's. */
export type OrbitId = "mercury" | "venus" | "earth" | "mars" | "jupiter" | "saturn" | "pluto";

/** A globe the shared close-up draws: a planet, a named small world or a moon. */
export type WorldBody = Exclude<SurfaceSelection, { kind: "sun" }>;

export type World = {
  id: WorldId;
  orbit: OrbitId;
  /** The globe the shared close-up draws, its measured map at true size. */
  body: WorldBody;
};

export const WORLDS: Readonly<Record<WorldId, World>> = {
  earth: { id: "earth", orbit: "earth", body: { kind: "planet", id: "earth" } },
  mars: { id: "mars", orbit: "mars", body: { kind: "planet", id: "mars" } },
  europa: { id: "europa", orbit: "jupiter", body: { kind: "moon", id: "europa" } },
  enceladus: { id: "enceladus", orbit: "saturn", body: { kind: "moon", id: "enceladus" } },
  pluto: { id: "pluto", orbit: "pluto", body: { kind: "named", id: "pluto" } },
};

const ORBIT_IDS = [
  "mercury",
  "venus",
  "earth",
  "mars",
  "jupiter",
  "saturn",
  "pluto",
] as const satisfies readonly OrbitId[];

/** Each orbit's mean distance today, au: the JPL elements' semi-major axis at J2000. */
export const ORBITS_AU: Readonly<Record<OrbitId, number>> = recordFrom(
  ORBIT_IDS,
  (id) => jplElements(id, 0).a,
);

/** An orbit's radius once the Sun has lost mass to `mass` M☉, au. */
export const orbitAt = (orbit: OrbitId, mass: number) =>
  orbitWidening.compute({ a0: ORBITS_AU[orbit], M: mass });

/** What a world sees of the Sun at an age. */
export type Standing = {
  /** The orbit's radius then, au. */
  distance: number;
  /** The orbit's period then, years. */
  period: number;
  /** Sunlight as a share of Earth's today. */
  sunlight: number;
  /** The Sun's angular diameter, radians (π: the whole sky). */
  sunWidth: number;
  /** The Sun's radius has reached the orbit. */
  inside: boolean;
};

export function standingAt(orbit: OrbitId, age: number): Standing {
  const sun = sunAt(age);
  const distance = orbitAt(orbit, sun.mass);
  return {
    distance,
    period: orbitalPeriod.compute({ a: distance, M: sun.mass }),
    sunlight: sunlightShare.compute({ L: sun.luminosity, d: distance }),
    sunWidth: angularSize.compute({ R: sun.radiusAu, d: distance }),
    inside: sun.radiusAu >= distance,
  };
}

/**
 * A world's equilibrium temperature at an age, K: the warmth the Sun's light alone holds it at,
 * from the Sun's surface temperature and radius, the widened orbit and the world's Bond albedo
 * today. No greenhouse: today's Earth reads 255 K against its measured 288 K; null once the
 * Sun has reached the orbit.
 */
export function temperatureAt(world: WorldId, age: number): number | null {
  const sun = sunAt(age);
  const { distance, inside } = standingAt(WORLDS[world].orbit, age);
  if (inside) return null;
  return equilibriumTemperature.compute({
    T: sun.teff,
    A: BOND_ALBEDO[world].value,
    R: sun.radiusAu,
    d: distance,
  });
}

/** The first age on the climb (the main sequence's end to the tip) at which `over` turns positive: the tip if it never does. */
function climbReaches(over: (age: number) => number): number {
  let lo = MS_END;
  let hi = RGB_TIP;
  for (let step = 0; step < 60; step += 1) {
    const mid = (lo + hi) / 2;
    if (over(mid) >= 0) hi = mid;
    else lo = mid;
  }
  return hi;
}

/** The first age at which the Sun's radius reaches an orbit (widened as it is then); null if it never does. */
function radiusReaches(orbit: OrbitId): number | null {
  const over = (age: number) => sunAt(age).radiusAu - orbitAt(orbit, sunAt(age).mass);
  return over(RGB_TIP) < 0 ? null : climbReaches(over);
}

/**
 * The first age on the climb at which the habitable zone's centre (the geometric mean of its
 * edges) reaches an orbit, widened as it is then: a world there gets the sunlight the zone's
 * middle gets, for as long as the climb takes the zone past it.
 */
export function zoneReaches(orbit: OrbitId): number {
  return climbReaches((age) => {
    const { zone, mass } = sunAt(age);
    return Math.sqrt(zone.inner * zone.outer) - orbitAt(orbit, mass);
  });
}

/** On the climb the habitable zone passes Saturn: Enceladus's warm spell, a few tens of millions of years. */
export const WARM_SPELL = zoneReaches("saturn");

/** How long before the tip tides and drag pull each inner planet in (Schröder & Smith 2008), years. */
const PULLED_IN: Readonly<Partial<Record<OrbitId, number>>> = {
  mercury: EARTH_ENGULFED_BEFORE_TIP + MERCURY_BEFORE_EARTH,
  venus: EARTH_ENGULFED_BEFORE_TIP + VENUS_BEFORE_EARTH,
  earth: EARTH_ENGULFED_BEFORE_TIP,
};

/** A planet's fate: swallowed at an age; Earth's, swallowed by tides though its widened orbit would escape; or spared. */
export type Fate =
  | { kind: "engulfed"; age: number }
  | { kind: "uncertain"; age: number }
  | { kind: "survives" };

const FATES = new Map<OrbitId, Fate>();

export function fateOf(orbit: OrbitId): Fate {
  const known = FATES.get(orbit);
  if (known) return known;
  const reached = radiusReaches(orbit);
  const pulledIn = PULLED_IN[orbit];
  let fate: Fate;
  if (pulledIn !== undefined) {
    /* The tides' time; where the radius alone would never reach the orbit, the fate is argued. */
    fate = { kind: reached === null ? "uncertain" : "engulfed", age: RGB_TIP - pulledIn };
  } else {
    fate = reached === null ? { kind: "survives" } : { kind: "engulfed", age: reached };
  }
  FATES.set(orbit, fate);
  return fate;
}

/** Whether a world is gone by an age: swallowed, Earth by tides. */
export function lostBy(orbit: OrbitId, age: number) {
  const fate = fateOf(orbit);
  return fate.kind !== "survives" && age >= fate.age;
}

/**
 * Where a visitor who would stand on `world` stands at an age: on it while it is there, and
 * once it is swallowed on the nearest world outward that is not, so the view never shows a
 * world the Sun has taken.
 */
export function standingWorld(world: WorldId, age: number): WorldId {
  const from = WORLD_IDS.indexOf(world);
  return (
    WORLD_IDS.slice(from).find((id) => !lostBy(WORLDS[id].orbit, age)) ??
    WORLD_IDS[WORLD_IDS.length - 1]!
  );
}
