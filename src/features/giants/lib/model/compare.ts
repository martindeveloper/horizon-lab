/**
 * How one body measures against another, and where the stars sit on a Hertzsprung–Russell
 * diagram: what the card teaches with beside its own figures. Ratios use the figures the
 * ladder draws (`drawn`), so they agree with the scene; spreads stay on the card's rows.
 */
import { stefanBoltzmann } from "@horizon/toolkit/science";

import { RUNG_FACTS, drawn, inUnit, radiusMetres } from "./catalogue";
import { RUNGS, RUNG_IDS, rungIndex, type RungId } from "./rungs";

/** What a body is measured against: the Sun, Earth, or the next smaller body on the ladder. */
export const REFERENCES = ["sun", "earth", "previous"] as const;
export type Reference = (typeof REFERENCES)[number];

/** The body a reference names for this one; none where it is the body itself or has none below. */
export function referenceBody(reference: Reference, id: RungId): RungId | null {
  const other = reference === "previous" ? (RUNG_IDS[rungIndex(id) - 1] ?? null) : reference;
  return other === id ? null : other;
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

/** A star on the diagram: its temperature (K), its light (Suns) and its radius (R☉). */
export type HrPoint = { id: RungId; kelvin: number; light: number; radius: number };

/** Every body on the ladder that shines by its temperature, in ladder order. */
export const HR_POINTS: readonly HrPoint[] = RUNG_IDS.flatMap((id) => {
  const kelvin = kelvinOf(id);
  const light = lightOf(id);
  if (kelvin === undefined || light === undefined) return [];
  const { radius } = RUNG_FACTS[id];
  return [{ id, kelvin, light, radius: inUnit(radius, "Rsun")(drawn(radius)) }];
});

/** The bands an HR diagram is read by, as a star's luminosity class names them. */
export const HR_GROUPS = ["whiteDwarfs", "mainSequence", "giants", "supergiants"] as const;
export type HrGroup = (typeof HR_GROUPS)[number];

/** MK luminosity classes: D a white dwarf, V the main sequence, III a giant, I a supergiant. */
const CLASSES: readonly (readonly [RegExp, HrGroup])[] = [
  [/^D/, "whiteDwarfs"],
  [/\bV[a-z]*$/, "mainSequence"],
  [/\bIII$/, "giants"],
  [/\bI[ab–]*$/, "supergiants"],
];

/** A body's band by its spectral type; none for a type without a luminosity class. */
export function groupOf(id: RungId): HrGroup | undefined {
  const type = RUNGS.find((rung) => rung.id === id)!.type;
  return CLASSES.find(([pattern]) => pattern.test(type))?.[1];
}
