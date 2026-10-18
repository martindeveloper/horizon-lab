/** Orbital elements on the timeline: measured today, rewound by Neptune's migration in the sketch. */
import {
  GIANTS,
  centuriesSinceJ2000,
  jplElements,
  type Elements,
  type NamedBody,
  type NamedId,
  type PlanetId,
} from "@horizon/toolkit/bodies";

import { migratedElement } from "./equations";

const migrated = (start: number, today: number, mig: number) =>
  migratedElement.compute({ start, today, mig });

/**
 * Compact starting orbits in the style of the Nice model (Tsiganis et al. 2005), a sketch,
 * not data. Later work starts the giants in a resonant chain (Jupiter–Saturn 3:2) that
 * breaks, with Jupiter and Saturn jumping past the 2:1 in ice-giant encounters (Nesvorný 2018).
 */
const START: Partial<Record<PlanetId, { a: number; e: number; i: number }>> = {
  jupiter: { a: 5.45, e: 0.02, i: 0.4 },
  saturn: { a: 8.18, e: 0.02, i: 0.5 },
  uranus: { a: 11.5, e: 0.02, i: 0.4 },
  neptune: { a: 14.2, e: 0.02, i: 0.4 },
};

export function startElements(id: PlanetId) {
  return START[id] ?? null;
}

/** Named bodies the sketch rewinds with Neptune's migration, and where they start. */
const NAMED_START: Partial<Record<NamedId, { a: number; e: number; i: number }>> = {
  pluto: { a: 28, e: 0.04, i: 2 },
};

/** True when the deep-past sketch rewinds this body with Neptune's migration. */
export const rewinds = (id: NamedId) => id in NAMED_START;

/**
 * Planet elements at a moment on the timeline. `date` is the real clock,
 * `driftYears` the visual along-orbit speed-up. Terrestrial planets never move
 * in the sketch; giants interpolate from the sketch start to the measured orbit.
 */
export function planetElements(
  id: PlanetId,
  mig: number,
  driftYears: number,
  date: Date,
): Elements {
  const now = jplElements(id, centuriesSinceJ2000(date, driftYears));
  const start = START[id];
  if (!start || mig >= 1) return now;
  return {
    ...now,
    a: migrated(start.a, now.a, mig),
    e: migrated(start.e, now.e, mig),
    i: migrated(start.i, now.i, mig),
  };
}

export function namedElements(
  body: NamedBody,
  mig: number,
  driftYears: number,
  date: Date,
): Elements {
  const now = body.elementsAt(date, driftYears);
  const start = NAMED_START[body.id];
  if (!start || mig >= 1) return now;
  return {
    ...now,
    a: migrated(start.a, now.a, mig),
    e: migrated(start.e, now.e, mig),
    i: migrated(start.i, now.i, mig),
  };
}

export const isGiant = (id: PlanetId) => GIANTS.has(id);
