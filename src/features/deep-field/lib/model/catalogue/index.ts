/**
 * Every figure a Deep Field card prints, once: value or published span, a unit of the
 * science kit, a source and how it was checked. Messages keep only the words around it
 * ("About {value} galaxies"); components/format.ts prints it in the visitor's distance unit
 * and language.
 *
 * The figures are the shared worlds' (`@/space/galaxy`, `@/space/cosmos`, the solar system's
 * reach); this composes them as Deep Field's cards read them. Values the model computes with
 * stay in the model and are referenced there, not copied. docs/science-sources.md lists the
 * catalogues (`npm run docs:catalogue`).
 */
import { factsOf, type Fact } from "@/lib/facts";
import { COSMOS } from "@/space/cosmos/model/catalogue";
import { GALAXY } from "@/space/galaxy/model/catalogue/galaxy";
import { STARS } from "@/space/galaxy/model/catalogue/stars";
import { POPULATIONS } from "@/space/solar-system/model/catalogue";
import { PROBE_CATALOGUE as PROBES } from "@/space/solar-system/model/probes-catalogue";

export const CATALOGUE = {
  stars: STARS,
  galaxy: GALAXY,
  cosmos: COSMOS,
  probes: PROBES,
} as const;

/**
 * Every figure the view hints and technical notes quote, by the placeholder their messages use. They print
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
  kuiperAu: POPULATIONS.kuiper.region,
  oortLy: { ...POPULATIONS.oort.outerEdge, show: "ly", digits: 2 },
  galaxyLy: GALAXY.milkyway.diskWidth,
  localGroupMly: COSMOS.localGroup.width,
  localSheetMly: COSMOS.localSheet.width,
  virgoGalaxies: COSMOS.virgo.members,
  virgoMly: { ...COSMOS.virgo.distance, digits: 2 },
  superclusterMly: COSMOS.supercluster.width,
} satisfies Record<string, Fact>;

/** Every fact with its path ("cosmos.virgo.members"), for tests and the ledger. */
export const catalogueFacts = () => factsOf(CATALOGUE);
