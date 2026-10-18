/**
 * Every figure an orrery card prints, once: value or published span, a unit of the
 * science kit, a source and how it was checked. Messages keep only the words around it
 * ("About {value} galaxies"); components/format.ts prints it in the visitor's distance
 * unit and language.
 *
 * Values the model computes with stay in the model (`parameters.ts`, `cosmos.ts`,
 * `neighbours.ts`, the toolkit's bodies) and are referenced here, not copied; figures that
 * follow the slider carry `at`. docs/science-sources.md lists the catalogue
 * (`npm run docs:catalogue`).
 */
import { COSMOS } from "./cosmos";
import { GALAXY } from "./galaxy";
import { NAMED_BODIES, PLANETS, POPULATIONS, SUN } from "./solar";
import { STARS } from "./stars";
import type { Fact, Facts } from "./types";

export * from "./types";
export { SOURCES, type Source, type SourceId } from "./sources";

export const CATALOGUE = {
  sun: SUN,
  planets: PLANETS,
  named: NAMED_BODIES,
  populations: POPULATIONS,
  stars: STARS,
  galaxy: GALAXY,
  cosmos: COSMOS,
} as const;

/** Every fact with its path ("cosmos.virgo.members"), for tests and the ledger. */
export function catalogueFacts(): { path: string; fact: Fact }[] {
  return Object.entries(CATALOGUE).flatMap(([group, entries]) =>
    Object.entries(entries as Record<string, Facts>).flatMap(([id, facts]) =>
      Object.entries(facts).map(([name, fact]) => ({ path: `${group}.${id}.${name}`, fact })),
    ),
  );
}
