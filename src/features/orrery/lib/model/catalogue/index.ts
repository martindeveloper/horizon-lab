/**
 * The Orrery's own figures, the formation timeline and the model's clocks; the bodies' are
 * the solar system catalogue's (`@/space/solar-system/model/catalogue`). Each is a value or
 * published span, a unit of the science kit, a source and how it was checked.
 * docs/science-sources.md lists the catalogues (`npm run docs:catalogue`).
 */
import { factsOf, type Fact } from "@/lib/facts";
import { PLANETS, POPULATIONS, SOLAR_CATALOGUE } from "@/space/solar-system/model/catalogue";
import { HABITABLE_ZONE } from "@/space/sun/model/young-sun";

import { SUN } from "./sun";
import { TIMELINE } from "./timeline";

const CATALOGUE = { timeline: TIMELINE, sun: SUN } as const;

/**
 * Every figure the timeline notes, the guide and the technical notes quote, by the
 * placeholder their messages use. They print as numbers in the unit the prose names (`show`),
 * not in the visitor's distance unit: "{snowLineAu} au".
 */
export const PROSE_FIGURES = {
  sunBirthGyr: TIMELINE.formation.firstSolids,
  coreDensity: TIMELINE.formation.coreDensity,
  freeFallKyr: TIMELINE.formation.freeFall,
  protostarKyr: TIMELINE.formation.protostar,
  gasMyr: TIMELINE.formation.gasDisk,
  diskLifetimesMyr: TIMELINE.formation.diskLifetimes,
  planetesimalsKyr: TIMELINE.formation.planetesimals,
  embryosMyr: TIMELINE.formation.embryos,
  jupiterCoreMyr: TIMELINE.formation.jupiterCore,
  marsHalfMyr: TIMELINE.formation.marsHalf,
  snowLineAu: TIMELINE.formation.snowLine,
  snowLineEstimatesAu: TIMELINE.formation.snowLineEstimates,
  moonImpactGyr: TIMELINE.formation.moonImpact,
  lhbGyr: TIMELINE.formation.lateHeavyBombardment,
  earthCrustGyr: TIMELINE.history.earthCrust,
  marsDynamoGyr: TIMELINE.history.marsDynamo,
  marsDryGyr: TIMELINE.history.marsDry,
  vredefortGyr: TIMELINE.history.vredefort,
  moonLavaGyr: TIMELINE.history.moonLava,
  moonGlassMyr: TIMELINE.history.moonGlass,
  ringsMyr: TIMELINE.history.saturnRings,
  chicxulubMyr: TIMELINE.history.chicxulub,
  moonKm: SOLAR_CATALOGUE.moons.moon.semiMajorAxis,
  moonFormedKm: SOLAR_CATALOGUE.moonDistance.formed.distance,
  moodiesShare: SOLAR_CATALOGUE.moonDistance.moodies.share,
  moodiesGyr: SOLAR_CATALOGUE.moonDistance.moodies.age,
  joffreKm: SOLAR_CATALOGUE.moonDistance.joffre.distance,
  joffreGyr: SOLAR_CATALOGUE.moonDistance.joffre.age,
  xiamalingKm: SOLAR_CATALOGUE.moonDistance.xiamaling.distance,
  xiamalingGyr: SOLAR_CATALOGUE.moonDistance.xiamaling.age,
  elatinaKm: SOLAR_CATALOGUE.moonDistance.elatina.distance,
  elatinaMyr: SOLAR_CATALOGUE.moonDistance.elatina.age,
  youngSunPercent: SUN.sun.start,
  zoneInnerAu: HABITABLE_ZONE.inner,
  zoneOuterAu: HABITABLE_ZONE.outer,
  modelStartGyr: TIMELINE.formation.modelStart,
  clearDoneGyr: TIMELINE.formation.clearingDone,
  jupiterStartAu: PLANETS.jupiter.start,
  saturnStartAu: PLANETS.saturn.start,
  uranusStartAu: PLANETS.uranus.start,
  neptuneStartAu: PLANETS.neptune.start,
  diskAu: POPULATIONS.disk.drawnAt,
  jupiterYears: PLANETS.jupiter.period,
  neptuneYears: PLANETS.neptune.period,
  oortInnerShellAu: POPULATIONS.oort.innerShell,
  oortShellAu: POPULATIONS.oort.outerShell,
  kuiperAu: POPULATIONS.kuiper.region,
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
