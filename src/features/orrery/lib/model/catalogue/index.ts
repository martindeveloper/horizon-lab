/**
 * The Orrery's own figures, the formation timeline and the model's clocks; the bodies' are
 * the solar system catalogue's (`@/space/solar-system/model/catalogue`). Each is a value or
 * published span, a unit of the science kit, a source and how it was checked.
 * docs/science-sources.md lists the catalogues (`npm run docs:catalogue`).
 */
import { factsOf, type Fact } from "@/lib/facts";
import { PLANETS, POPULATIONS } from "@/space/solar-system/model/catalogue";

import { TIMELINE } from "./timeline";

const CATALOGUE = { timeline: TIMELINE } as const;

/**
 * Every figure the timeline notes, the guide and the technical notes quote, by the
 * placeholder their messages use. They print as numbers in the unit the prose names (`show`),
 * not in the visitor's distance unit: "{snowLineAu} au".
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
  mergerGyr: TIMELINE.clocks.merger,
} satisfies Record<string, Fact>;

/** Every fact with its path ("planets.earth.radius"), for tests and the ledger. */
export const catalogueFacts = () => factsOf(CATALOGUE);
