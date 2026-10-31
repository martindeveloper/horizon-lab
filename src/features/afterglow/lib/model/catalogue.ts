/**
 * Every figure Afterglow's captions, cards and technical notes quote, by the placeholder their
 * messages use: the track's own rows and what follows from them by the laws, and the shared
 * catalogue's Sirius B. They print as numbers in the unit the prose names: "{tipRadiusRsun}
 * solar radii". The ledger lists the track's rows too (`catalogueFacts`).
 */
import { factsOf, proseFacts, quoteAs, type Fact, type Facts, type ProseFigure } from "@/lib/facts";
import { NAMED_STARS } from "@/space/stellar";
import { habitableZoneAt } from "@/space/sun/model/young-sun";
import { SOLAR_RADIUS_KM } from "@horizon/toolkit/science";

import { EARTH_DRY, OCEANS_GOING, RUNAWAY_AU, WATER_LOSS_AU } from "./oceans";
import { sunAt } from "./sun";
import { DWARF_STEP_AGE, FLASH_STEP_AGE } from "./tour";
import {
  AGB_TIP,
  COOLING_START,
  DWARF_MASS,
  EARTH_ENGULFED_BEFORE_TIP,
  HELIUM_START,
  HELIUM_YEARS,
  MS_END,
  NEBULA_END,
  NEBULA_YEARS,
  OCEANS_AFTER,
  RGB_TIP,
  TODAY,
  TRACK,
  type TrackRow,
} from "./track";
import {
  BOND_ALBEDO,
  WARM_SPELL,
  WORLD_IDS,
  fateOf,
  orbitAt,
  standingAt,
  temperatureAt,
} from "./worlds";

const DEG_PER_RAD = 180 / Math.PI;

const tip = sunAt(RGB_TIP);
const row = (id: string) => TRACK.find((r) => r.id === id)!;
const lostBeforeTip = (orbit: "mercury" | "venus") => {
  const fate = fateOf(orbit);
  return fate.kind === "survives" ? 0 : RGB_TIP - fate.age;
};
/** The white dwarf has cooled to the row's temperature this long after the nebula. */
const coolingAge = (id: string) => row(id).age - NEBULA_END;

export const PROSE_FIGURES = {
  youngSunPercent: {
    value: row("zams").luminosity * 100,
    unit: "percent",
    digits: 2,
    source: "schroder2008",
    sources: ["sackmann1993"],
    status: "derived",
    note: "the zero-age main sequence's luminosity as a share of today's",
  },
  todayGyr: {
    value: TODAY,
    unit: "yr",
    show: "Gyr",
    digits: 3,
    source: "connelly2012",
    status: "verified",
    note: "the first solids' age",
  },
  oceansGyr: {
    value: OCEANS_AFTER,
    unit: "yr",
    show: "Gyr",
    source: "schroder2008",
    status: "verified",
    note: "the habitable zone's inner edge crosses 1 au in about a billion years",
  },
  msEndGyr: {
    value: MS_END,
    unit: "yr",
    show: "Gyr",
    digits: 3,
    source: "schroder2008",
    status: "verified",
  },
  tipGyrAhead: {
    value: RGB_TIP - TODAY,
    unit: "yr",
    show: "Gyr",
    digits: 2,
    source: "schroder2008",
    status: "derived",
    note: "the red-giant tip at 12.167 Gy, 7.59 Gy from now",
  },
  tipRadiusRsun: {
    value: tip.radius,
    unit: "Rsun",
    digits: 3,
    source: "schroder2008",
    status: "derived",
    note: "from L and Teff by Stefan–Boltzmann; the table reads 256 R☉",
  },
  tipRadiusAu: {
    value: tip.radiusAu,
    unit: "au",
    digits: 2,
    source: "schroder2008",
    status: "derived",
  },
  tipLuminosity: {
    value: row("rgbTip").luminosity,
    unit: "Lsun",
    digits: 3,
    source: "schroder2008",
    status: "verified",
  },
  tipKelvin: {
    value: row("rgbTip").teff,
    unit: "K",
    digits: 2,
    source: "schroder2008",
    status: "verified",
  },
  massLostPercent: {
    value: (1 - row("rgbTip").mass) * 100,
    unit: "percent",
    digits: 2,
    source: "schroder2008",
    status: "derived",
    note: "0.332 M☉ lost on the giant branch",
  },
  earthTipOrbitAu: {
    value: orbitAt("earth", row("rgbTip").mass),
    unit: "au",
    digits: 2,
    source: "schroder2008",
    status: "derived",
    note: "Earth's orbit widened by the mass lost, angular momentum kept",
  },
  waterLossAu: {
    value: WATER_LOSS_AU,
    unit: "au",
    digits: 2,
    source: "kasting1993",
    status: "verified",
    note: "the moist-greenhouse limit for today's Sun",
  },
  runawayAu: {
    value: RUNAWAY_AU,
    unit: "au",
    digits: 2,
    source: "kasting1993",
    status: "verified",
    note: "the runaway-greenhouse limit for today's Sun",
  },
  oceansGoingGyrAhead: {
    value: OCEANS_GOING - TODAY,
    unit: "yr",
    show: "Gyr",
    digits: 2,
    source: "kasting1993",
    sources: ["schroder2008"],
    status: "derived",
    note: "Earth's sunlight on the track reaches the moist-greenhouse limit's",
  },
  oceansGoneGyrAhead: {
    value: EARTH_DRY - TODAY,
    unit: "yr",
    show: "Gyr",
    digits: 2,
    source: "kasting1993",
    sources: ["schroder2008"],
    status: "derived",
    note: "Earth's sunlight on the track reaches the runaway-greenhouse limit's",
  },
  earthTodayKelvin: {
    value: temperatureAt("earth", TODAY) ?? 0,
    unit: "K",
    digits: 3,
    source: "nssdc",
    status: "derived",
    note: "Earth's equilibrium temperature today from the Sun's temperature and radius and Earth's Bond albedo",
  },
  earthEscapeAu: {
    value: 1.15,
    unit: "au",
    digits: 3,
    source: "schroder2008",
    status: "verified",
    note: "the present orbital radius a planet needs to pass the tip",
  },
  earthLostKyr: {
    value: EARTH_ENGULFED_BEFORE_TIP,
    unit: "yr",
    show: "kyr",
    source: "schroder2008",
    status: "verified",
    note: "engulfed by tides and drag half a million years before the tip",
  },
  mercuryLostMyr: {
    value: lostBeforeTip("mercury"),
    unit: "yr",
    show: "Myr",
    digits: 2,
    source: "schroder2008",
    status: "derived",
    note: "where the drawn climb reaches Mercury's widened orbit; Schröder & Smith: 4.3 Myr",
  },
  venusLostMyr: {
    value: lostBeforeTip("venus"),
    unit: "yr",
    show: "Myr",
    digits: 2,
    source: "schroder2008",
    status: "derived",
    note: "where the drawn climb reaches Venus's widened orbit; Schröder & Smith: 1.5 Myr",
  },
  marsTipWidthDeg: {
    value: standingAt("mars", RGB_TIP).sunWidth * DEG_PER_RAD,
    unit: "deg",
    digits: 2,
    source: "schroder2008",
    status: "derived",
    note: "the tip's disc from Mars's widened orbit",
  },
  todayWidthDeg: {
    value: standingAt("earth", TODAY).sunWidth * DEG_PER_RAD,
    unit: "deg",
    digits: 2,
    source: "schroder2008",
    status: "derived",
  },
  zoneTipInnerAu: {
    value: habitableZoneAt(row("rgbTip").luminosity).inner,
    unit: "au",
    digits: 2,
    source: "kopparapu2013",
    sources: ["schroder2008"],
    status: "derived",
  },
  zoneTipOuterAu: {
    value: habitableZoneAt(row("rgbTip").luminosity).outer,
    unit: "au",
    digits: 2,
    source: "kopparapu2013",
    sources: ["schroder2008"],
    status: "derived",
  },
  enceladusWarmPercent: {
    value: standingAt("saturn", WARM_SPELL).sunlight * 100,
    unit: "percent",
    digits: 2,
    source: "schroder2008",
    status: "derived",
    note: "sunlight at Saturn's widened orbit as the habitable zone's centre passes it on the drawn climb, as a share of Earth's today",
  },
  europaFlashPercent: {
    value: standingAt("jupiter", FLASH_STEP_AGE).sunlight * 100,
    unit: "percent",
    digits: 2,
    source: "schroder2008",
    status: "derived",
    note: "sunlight at Jupiter's widened orbit while the core burns helium",
  },
  heliumMyr: {
    value: HELIUM_YEARS,
    unit: "yr",
    show: "Myr",
    digits: 2,
    source: "schroder2008",
    sources: ["millerBertolami2016"],
    status: "teaching-choice",
    note: "between Schröder & Smith's 130 Myr and Miller Bertolami's ~100 Myr",
  },
  heliumRadiusRsun: {
    value: sunAt(HELIUM_START).radius,
    unit: "Rsun",
    digits: 2,
    source: "schroder2008",
    status: "derived",
    note: "the table reads 11.2 R☉",
  },
  agbTipRadiusRsun: {
    value: sunAt(AGB_TIP).radius,
    unit: "Rsun",
    digits: 3,
    source: "schroder2008",
    status: "derived",
    note: "the table reads 149 R☉",
  },
  nebulaKyr: {
    value: NEBULA_YEARS,
    unit: "yr",
    show: "kyr",
    digits: 2,
    source: "millerBertolami2016",
    status: "verified",
    note: "τcross for a 0.55 M☉ remnant at Z = 0.02",
  },
  nebulaKilokelvin: {
    value: row("nebula").teff / 1000,
    unit: "count",
    digits: 2,
    source: "bergeronCooling",
    status: "derived",
    note: "the 0.5 M☉ cooling sequence's first temperature, thousands of kelvin",
  },
  dwarfMass: {
    value: DWARF_MASS,
    unit: "Msun",
    digits: 2,
    source: "schroder2008",
    status: "verified",
  },
  dwarfRadiusKm: {
    value: sunAt(COOLING_START).radius * SOLAR_RADIUS_KM,
    unit: "km",
    digits: 2,
    source: "bergeronCooling",
    status: "derived",
  },
  coolGyr: {
    value: coolingAge("cooling4k"),
    unit: "yr",
    show: "Gyr",
    digits: 2,
    source: "bergeronCooling",
    status: "derived",
    note: "to 4,000 K on the 0.5 M☉ sequence",
  },
  siriusBKelvin: quoteAs(NAMED_STARS["sirius-b"].teff, { digits: 2 }),
  dwarfSunlight: {
    value: standingAt("pluto", DWARF_STEP_AGE).sunlight,
    unit: "ratio",
    digits: 1,
    source: "bergeronCooling",
    status: "derived",
    note: "sunlight at Pluto's widened orbit two billion years into the fade, as a share of Earth's today",
  },
} satisfies Record<string, ProseFigure>;

/** The track's rows as facts: each row's light, temperature and mass under its id. */
const trackFacts = (): Record<string, Facts> =>
  Object.fromEntries(
    TRACK.map((r: TrackRow) => {
      const base = {
        source: r.source,
        status: r.status,
        ...(r.sources ? { sources: r.sources } : {}),
      };
      const facts: Record<string, Fact> = {
        age: {
          ...base,
          value: r.age,
          unit: "yr",
          show: "Gyr",
          digits: 5,
          ...(r.note ? { note: r.note } : {}),
        },
        luminosity: { ...base, value: r.luminosity, unit: "Lsun", digits: 3 },
        teff: { ...base, value: r.teff, unit: "K", digits: 4 },
        mass: { ...base, value: r.mass, unit: "Msun", digits: 4 },
      };
      return [r.id, facts];
    }),
  );

/** Every fact with its path, for tests and the ledger. */
export const catalogueFacts = () =>
  factsOf({
    track: trackFacts(),
    worlds: Object.fromEntries(WORLD_IDS.map((id) => [id, { bondAlbedo: BOND_ALBEDO[id] }])),
    prose: { figures: proseFacts(PROSE_FIGURES) },
  });
