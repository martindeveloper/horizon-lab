/**
 * Every figure Voyage's guide, cards and technical notes quote, by the placeholder their
 * messages use: the shared catalogues' (`@/space`), and what follows from them for the ship.
 * They print as numbers in the unit the prose names: "{ioPeriodHours} hours".
 */
import { factsOf, proseFacts, quoteAs, type ProseFigure } from "@/lib/facts";
import { STARS } from "@/space/galaxy/model/catalogue/stars";
import { SOLAR_CATALOGUE } from "@/space/solar-system/model/catalogue";
import { jplElements } from "@horizon/toolkit/bodies";
import {
  JULIAN_YEAR_SECONDS,
  SPEED_OF_LIGHT_KM_S,
  STANDARD_GRAVITY,
  coastTrip,
  convertFigure,
  torchTrip,
} from "@horizon/toolkit/science";

import { DRIVES } from "./parameters";

const ALPHA_CEN = STARS.alphaCen;
const alphaCenKm = convertFigure(ALPHA_CEN.distance.value, ALPHA_CEN.distance.unit, "km");
const voyagerKms = DRIVES.voyager.kind === "coast" ? DRIVES.voyager.speed : 0;
/** The torch ship's clocks to α Centauri: one g to the midpoint and one g back down. */
const torchToAlphaCen = torchTrip(alphaCenKm, STANDARD_GRAVITY);

export const PROSE_FIGURES = {
  voyagerKms: {
    value: voyagerKms,
    unit: "km/s",
    digits: 2,
    source: "horizonsProbes",
    status: "teaching-choice",
    note: "Voyager 1's 16.9 km/s in 2026, rounded",
  },
  moonLightSeconds: {
    value: SOLAR_CATALOGUE.moons.moon.semiMajorAxis.value / SPEED_OF_LIGHT_KM_S,
    unit: "s",
    digits: 2,
    source: "jplSatElements",
    status: "derived",
    note: "the Moon's mean distance over c",
  },
  marsSunlightPercent: {
    value: 100 / jplElements("mars", 0).a ** 2,
    unit: "percent",
    digits: 2,
    source: "jplElements",
    status: "derived",
    note: "the inverse square at Mars's mean distance",
  },
  ioPeriodHours: quoteAs(SOLAR_CATALOGUE.moons.io.period, { in: "h", digits: 2 }),
  abSeparationAu: ALPHA_CEN.abSeparation,
  abPeriodYears: quoteAs(ALPHA_CEN.abPeriod, { digits: 2 }),
  voyagerYears: {
    value: coastTrip(alphaCenKm, voyagerKms).t / JULIAN_YEAR_SECONDS,
    unit: "yr",
    digits: 2,
    source: "akeson2021",
    status: "derived",
    note: "α Centauri's distance at Voyager's speed",
  },
  torchAlphaCenYears: {
    value: torchToAlphaCen.tau / JULIAN_YEAR_SECONDS,
    unit: "yr",
    digits: 2,
    source: "akeson2021",
    status: "derived",
    note: "α Centauri's distance at one g, turning over halfway: the ship's own clock",
  },
  torchAlphaCenEarthYears: {
    value: torchToAlphaCen.t / JULIAN_YEAR_SECONDS,
    unit: "yr",
    digits: 2,
    source: "akeson2021",
    status: "derived",
    note: "the same trip on Earth's clock",
  },
} satisfies Record<string, ProseFigure>;

export const catalogueFacts = () => factsOf({ voyage: { prose: proseFacts(PROSE_FIGURES) } });
