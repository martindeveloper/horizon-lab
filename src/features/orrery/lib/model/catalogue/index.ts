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
import { TIMELINE } from "./timeline";
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
  timeline: TIMELINE,
} as const;

/**
 * Every figure the timeline notes, the guide and the technical notes quote, by the
 * placeholder their messages use. They print as numbers in the unit the prose names (`show`),
 * not in the visitor's distance unit: "{sunRadiusKpc} kpc".
 */
export const PROSE_FIGURES = {
  sunBirthGyr: TIMELINE.formation.firstSolids,
  gasMyr: TIMELINE.formation.gasDisk,
  diskLifetimesMyr: TIMELINE.formation.diskLifetimes,
  planetesimalsKyr: TIMELINE.formation.planetesimals,
  embryosMyr: TIMELINE.formation.embryos,
  snowLineAu: TIMELINE.formation.snowLine,
  snowLineEstimatesAu: TIMELINE.formation.snowLineEstimates,
  moonImpactGyr: TIMELINE.formation.moonImpact,
  lhbGyr: TIMELINE.formation.lateHeavyBombardment,
  modelStartGyr: TIMELINE.formation.modelStart,
  clearDoneGyr: TIMELINE.formation.clearingDone,
  jupiterStartAu: PLANETS.jupiter.start,
  saturnStartAu: PLANETS.saturn.start,
  uranusStartAu: PLANETS.uranus.start,
  neptuneStartAu: PLANETS.neptune.start,
  diskAu: POPULATIONS.disk.drawnAt,
  jupiterYears: PLANETS.jupiter.period,
  neptuneYears: PLANETS.neptune.period,
  oortShellAu: POPULATIONS.oort.outerShell,
  plutinosAu: POPULATIONS.kuiper.plutinos,
  twotinosAu: POPULATIONS.kuiper.twotinos,
  tracers: POPULATIONS.tracers.count,
  timelineGyr: TIMELINE.clocks.oldest,
  thinDiskGyr: TIMELINE.clocks.thinDisk,
  namedStarsYears: TIMELINE.clocks.namedStarsFade,
  neighbourYears: TIMELINE.clocks.neighbourWindow,
  mergerGyr: GALAXY.milkyway.gaiaEnceladus,
  galacticYearMyr: GALAXY.sun.lap,
  laps: GALAXY.sun.laps,
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
  growthPower: COSMOS.universe.clusterGrowth,
  andromedaMly: COSMOS.andromeda.distance,
  andromedaKms: COSMOS.andromeda.approach,
} satisfies Record<string, Fact>;

/** Every fact with its path ("cosmos.virgo.members"), for tests and the ledger. */
export function catalogueFacts(): { path: string; fact: Fact }[] {
  return Object.entries(CATALOGUE).flatMap(([group, entries]) =>
    Object.entries(entries as Record<string, Facts>).flatMap(([id, facts]) =>
      Object.entries(facts).map(([name, fact]) => ({ path: `${group}.${id}.${name}`, fact })),
    ),
  );
}
