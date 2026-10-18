/**
 * Every figure a Deep Field card prints, once: value or published span, a unit of the
 * science kit, a source and how it was checked. Messages keep only the words around it
 * ("About {value} galaxies"); components/format.ts prints it in the visitor's distance unit
 * and language.
 *
 * Values the model computes with stay in the model (`parameters.ts`, `cosmos.ts`,
 * `neighbours.ts`) and are referenced here, not copied. docs/science-sources.md lists the
 * catalogue (`npm run docs:catalogue`).
 */
import { factsOf, type Fact } from "@/lib/facts";

import { COSMOS } from "./cosmos";
import { GALAXY } from "./galaxy";
import { PROBES } from "./probes";
import { STARS } from "./stars";

export const CATALOGUE = {
  stars: STARS,
  galaxy: GALAXY,
  cosmos: COSMOS,
  probes: PROBES,
} as const;

/**
 * Every figure the technical notes quote, by the placeholder their messages use. They print
 * as numbers in the unit the prose names (`show`), not in the visitor's distance unit:
 * "{sunRadiusKpc} kpc".
 */
export const PROSE_FIGURES = {
  galacticYearMyr: GALAXY.sun.lap,
  sunRadiusKpc: GALAXY.sun.centre,
  radialSwingKpc: GALAXY.sun.radialSwing,
  radialMyr: GALAXY.sun.radialPeriod,
  verticalPc: GALAXY.sun.verticalAmplitude,
  verticalMyr: GALAXY.sun.verticalPeriod,
  heightPc: GALAXY.sun.height,
  barHalfKpc: GALAXY.bulge.barHalfLength,
  barDeg: GALAXY.bulge.barAngle,
  pitchDeg: GALAXY.milkyway.armPitch,
  warpStartKpc: GALAXY.milkyway.warpStart,
  thinLengthKpc: GALAXY.milkyway.thinDiskLength,
  thinHeightPc: GALAXY.milkyway.thinDiskHeight,
  thickLengthKpc: GALAXY.milkyway.thickDiskLength,
  thickHeightPc: GALAXY.milkyway.thickDiskHeight,
  haloKpc: GALAXY.halo.r200,
  hubble: COSMOS.universe.hubble,
  omegaM: COSMOS.universe.matter,
  universeGyr: COSMOS.universe.age,
  andromedaMly: COSMOS.andromeda.distance,
  andromedaKms: COSMOS.andromeda.approach,
} satisfies Record<string, Fact>;

/** Every fact with its path ("cosmos.virgo.members"), for tests and the ledger. */
export const catalogueFacts = () => factsOf(CATALOGUE);
