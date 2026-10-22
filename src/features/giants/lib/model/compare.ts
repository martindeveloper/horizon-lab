/**
 * How one body measures against another, and which band of the Hertzsprung–Russell diagram a
 * star belongs to: what the card teaches with beside its own figures. Ratios use the figures the
 * ladder draws (`drawn`), so they agree with the scene; spreads stay on the card's rows.
 */
import { groupOfType, type HrGroup } from "@/space/hr-diagram";
import { stefanBoltzmann } from "@horizon/toolkit/science";

import { RUNG_FACTS, drawn, inUnit, radiusMetres, spectralOf } from "./catalogue";
import { RUNGS, RUNG_IDS, rungIndex, type RungId } from "./rungs";

/**
 * What a body is measured against: the Sun, Earth, the next smaller body on the ladder, or any
 * other body the visitor picks.
 */
export const REFERENCES = ["sun", "earth", "previous", "other"] as const;
export type Reference = (typeof REFERENCES)[number];

/**
 * The body a reference names for this one, `other` the body picked for "other"; none where it
 * is the body itself or has none below.
 */
export function referenceBody(reference: Reference, id: RungId, other: RungId): RungId | null {
  const body =
    reference === "previous"
      ? (RUNG_IDS[rungIndex(id) - 1] ?? null)
      : reference === "other"
        ? other
        : reference;
  return body === id ? null : body;
}

const kindOf = (id: RungId) => RUNGS.find((rung) => rung.id === id)!.kind;

const massKg = (id: RungId) => {
  const { mass } = RUNG_FACTS[id];
  return mass ? inUnit(mass, "kg")(drawn(mass)) : undefined;
};

/** Surface temperature, K, for a body that shines by it (no planet, no horizon). */
export function kelvinOf(id: RungId) {
  const { teff } = RUNG_FACTS[id];
  const kind = kindOf(id);
  return teff && kind !== "planet" && kind !== "horizon" ? drawn(teff) : undefined;
}

/** Light in Suns: the catalogue's, else from radius and temperature by Stefan–Boltzmann. */
export function lightOf(id: RungId) {
  const { luminosity, radius } = RUNG_FACTS[id];
  if (luminosity) return drawn(luminosity);
  const T = kelvinOf(id);
  if (T === undefined) return undefined;
  return stefanBoltzmann.compute({ R: inUnit(radius, "Rsun")(drawn(radius)), T });
}

/** Adopted equatorial widths, spheroid volumes, masses and bolometric luminosities. */
export type Comparison = { width: number; volume?: number; mass?: number; light?: number };

const ratio = (a: number | undefined, b: number | undefined) =>
  a !== undefined && b !== undefined && b > 0 ? a / b : undefined;

export function compare(id: RungId, against: RungId): Comparison {
  const body = radiusMetres(id);
  const other = radiusMetres(against);
  const width = body.radius / other.radius;
  const result: Comparison = { width };
  // The same spheroid volume as the density model. A horizon is not a Euclidean ball
  // of material; comparing its coordinate volume to stellar volumes would mislead.
  if (kindOf(id) !== "horizon" && kindOf(against) !== "horizon")
    result.volume = width ** 2 * (body.polar / other.polar);
  const mass = ratio(massKg(id), massKg(against));
  const light = ratio(lightOf(id), lightOf(against));
  if (mass !== undefined) result.mass = mass;
  if (light !== undefined) result.light = light;
  return result;
}

/** A star's band on the HR diagram, by the luminosity class of its spectral type. */
export function groupOf(id: RungId): HrGroup | undefined {
  const spectral = spectralOf(id);
  return spectral ? groupOfType(spectral) : undefined;
}
