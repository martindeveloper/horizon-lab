/**
 * Every figure the Sun lab prints, once: measured ones from the shared catalogue of stars
 * (`NAMED_STARS.sun`), the solar system's Sun and the kit's constants; the interior's from Model
 * S; derived ones through the kit's laws and the model's own functions; the literature's with
 * their source and how far they were checked. docs/science-sources.md lists them
 * (`npm run docs:catalogue`).
 */
import {
  literatureFact,
  factsOf,
  quoteAs,
  type Fact,
  type Facts,
  type ProseFigure,
} from "@/lib/facts";
import { SOLAR_MEAN_MOLECULAR_WEIGHT } from "@/space/solar-composition";
import { SOLAR_CATALOGUE } from "@/space/solar-system/model/catalogue";
import { NAMED_STARS } from "@/space/stellar";
import { PLANET_RADIUS_KM } from "@horizon/toolkit/bodies";
import { keysOf, recordFrom } from "@horizon/toolkit/records";
import {
  RAD_PER_DEG,
  SOLAR_MASS_KG,
  meanDensity,
  pressureScaleHeight,
  schwarzschildRadius,
} from "@horizon/toolkit/science";

import { kCorona } from "./model/corona";
import {
  DALTON_MINIMUM,
  GROUP_NUMBERS,
  MAUNDER_MINIMUM,
  MODERN_MAXIMUM,
  SUNSPOT_NUMBERS,
  type YearlyCount,
} from "./model/cycle";
import { eruptionAt } from "./model/eruption";
import { PP_MASS_FRACTION, SOLAR_MASS_LOSS_KG_S } from "./model/fusion";
import { MAP_CENTRAL_MERIDIAN_DEG, OBSERVED_REGIONS } from "./model/observed";
import {
  CHROMOSPHERE_THICKNESS_KM,
  CYCLE_PERIOD_YR,
  CYCLE_RISE_YR,
  EQUATORIAL_DIPOLE,
  ERUPTION_SECONDS,
  ERUPTION_STAGES,
  E_CORONA_KELVIN,
  E_CORONA_LINE_NM,
  FLARE_POWER_INDEX,
  JOY_SLOPE,
  LOOP_KELVIN_RANGE,
  MAP_WINDOW_D,
  OBSERVED_MIN_AREA_MSH,
  LOOP_REFERENCE,
  POLAR_FIELD_T,
  RADIUS_M,
  SOURCE_SURFACE_R,
  SPORER_END_RAD,
  SPORER_START_RAD,
  SPOT_FIELD_T,
  SURFACE_GRAVITY,
  TACHOCLINE_R,
  TACHOCLINE_THICKNESS_R,
  TEMPERATURES,
  PARKER_PERIHELION_R,
  PARKER_PERIHELION_SPEED_KM_S,
  PARKER_CORONA_EDGE_R,
  PARKER_PERIOD_D,
  PARKER_SHIELD_PERIHELION_C,
  WATER_DENSITY,
  WIND_FAST_KM_S,
  WIND_SLOW_KM_S,
} from "./model/parameters";
import { PARKER_APHELION_R } from "./model/parker";
import { AIA_NM, AIA_PEAKS_K, HALPHA_NM, type Peak } from "./model/passbands";
import { CARRINGTON_SIDEREAL_RATE, INTERIOR_RATE, surfacePeriod } from "./model/rotation";
import { CORE_EDGE_R, photonDiffusionTime, structureAt } from "./model/structure";

const SUN = NAMED_STARS.sun;
const MODEL_S = "christensenDalsgaard1996";
const centre = structureAt(0);
const surface = structureAt(1);

/** The mean of a yearly record over a span of calendar years, inclusive. */
const meanOver = (record: readonly YearlyCount[], [from, to]: readonly [number, number]) => {
  const rows = record.filter((row) => row.year >= from && row.year <= to);
  return rows.reduce((sum, row) => sum + row.number, 0) / rows.length;
};
const peak = (record: readonly YearlyCount[]) =>
  record.reduce((best, row) => (row.number > best.number ? row : best), record[0]!);

/** The measured Sun, and what follows from it by the kit's laws. */
const BODY = {
  radius: SUN.radius,
  diameter: {
    value: 2 * RADIUS_M,
    unit: "m",
    show: "km",
    digits: 4,
    source: "iau2015b3",
    status: "derived",
    note: "2 R☉, nominal",
  },
  mass: SUN.mass,
  teff: SUN.teff,
  luminosity: SUN.luminosity,
  age: SOLAR_CATALOGUE.sun.sun.age,
  lightTime: SOLAR_CATALOGUE.sun.sun.auLightTime,
  meanDensity: {
    value: meanDensity.compute({ M: SOLAR_MASS_KG, R: RADIUS_M }) / WATER_DENSITY,
    unit: "ratio",
    digits: 3,
    source: "iau2015b3",
    status: "derived",
    note: `3M / 4πR³ over water's ${WATER_DENSITY} kg/m³`,
  },
  surfaceGravity: {
    value: SURFACE_GRAVITY,
    unit: "m/s2",
    digits: 3,
    source: "iau2015b3",
    status: "derived",
    note: "GM☉ / R☉²",
  },
  massLoss: {
    value: SOLAR_MASS_LOSS_KG_S,
    unit: "kg",
    digits: 3,
    source: "iau2015b3",
    status: "derived",
    note: "each second, photon luminosity L☉ / c²; excludes neutrinos and solar-wind mass loss",
  },
  ppMassFraction: {
    value: 100 * PP_MASS_FRACTION,
    unit: "percent",
    digits: 2,
    source: "nistIsotopeMasses",
    status: "derived",
    note: "(4 m(¹H) − m(⁴He)) / 4 m(¹H), neutral isotope masses; includes annihilation and neutrino energy",
  },
  schwarzschildRadius: {
    value: schwarzschildRadius.compute({ M: SOLAR_MASS_KG }),
    unit: "m",
    show: "km",
    digits: 3,
    source: "iau2015b3",
    status: "derived",
    note: "2GM☉ / c²",
  },
} satisfies Facts;

/** Model S inside, and the layer bounds. */
const INTERIOR = {
  coreRadius: {
    value: CORE_EDGE_R,
    unit: "Rsun",
    digits: 2,
    source: MODEL_S,
    status: "derived",
    note: "where Model S makes 99 % of the luminosity",
  },
  centralTemperature: {
    value: centre.T,
    unit: "K",
    digits: 3,
    source: MODEL_S,
    status: "verified",
    note: "the model's centre",
  },
  centralDensity: {
    value: centre.rho / WATER_DENSITY,
    unit: "ratio",
    digits: 3,
    source: MODEL_S,
    status: "verified",
    note: `the model's centre, over water's ${WATER_DENSITY} kg/m³ (g/cm³)`,
  },
  centralHydrogen: {
    value: 100 * centre.X,
    unit: "percent",
    digits: 2,
    source: MODEL_S,
    status: "verified",
    note: "hydrogen's mass fraction at the centre, against 0.74 at the surface",
  },
  tachocline: literatureFact(TACHOCLINE_R, "Rsun", "charbonneau1999", "flag", {
    digits: 3,
    note: "the base of the convection zone, after Basu & Antia 1997",
  }),
  tachoclineThickness: literatureFact(TACHOCLINE_THICKNESS_R, "Rsun", "charbonneau1999", "flag", {
    range: [0.026, 0.052],
    digits: 2,
  }),
  convectionDepth: {
    value: (1 - TACHOCLINE_R) * RADIUS_M,
    unit: "m",
    show: "km",
    digits: 3,
    source: "charbonneau1999",
    status: "derived",
    note: "(1 − 0.713) R☉",
  },
  photonWalk: {
    value: photonDiffusionTime(),
    unit: "s",
    show: "kyr",
    digits: 2,
    source: MODEL_S,
    sources: ["mitalasSills1992"],
    status: "derived",
    note: "Mitalas–Sills shell estimate: (6/c) ∫₀ᴿᶜᶻ κρr dr through Model S; not a thermal relaxation time",
  },
  photonWalkLiterature: literatureFact(1.7e5, "yr", "mitalasSills1992", "flag", {
    show: "kyr",
    digits: 2,
  }),
} satisfies Facts;

const PHOTOSPHERE = {
  temperature: SUN.teff,
  thickness: literatureFact(null, "km", "nordlund2009", "flag", { range: [300, 500] }),
  density: {
    value: surface.rho / WATER_DENSITY,
    unit: "ratio",
    digits: 2,
    source: MODEL_S,
    status: "verified",
    note: "the model at r = R, over water's density (g/cm³)",
  },
  scaleHeight: {
    value: pressureScaleHeight.compute({
      T: TEMPERATURES.photosphere,
      mu: SOLAR_MEAN_MOLECULAR_WEIGHT,
      g: SURFACE_GRAVITY,
    }),
    unit: "m",
    show: "km",
    digits: 3,
    source: "iau2015b3",
    sources: ["asplund2009"],
    status: "derived",
    note: "kT / (μ mᵤ g) for the neutral photospheric gas",
  },
  granuleSize: literatureFact(1_000, "km", "nordlund2009", "flag", { range: [500, 2_000] }),
  granuleLifetime: literatureFact(10, "min", "nordlund2009", "flag", { range: [5, 20] }),
  supergranuleSize: literatureFact(30_000, "km", "rieutordRincon2010", "flag", {
    range: [20_000, 50_000],
  }),
} satisfies Facts;

const SUNSPOT = {
  umbraIntensity: literatureFact(15, "percent", "solanki2003", "flag", {
    range: [5, 30],
    note: "of the photosphere's brightness, in visible light",
  }),
  umbraTemperature: literatureFact(null, "K", "solanki2003", "flag", { range: [3_700, 4_500] }),
  modelTemperature: literatureFact(TEMPERATURES.spot, "K", "horizon", "teaching-choice", {
    note: "what the model's spots glow at",
  }),
  diameter: literatureFact(null, "km", "solanki2003", "flag", {
    range: [20_000, 60_000],
    note: "a large spot, umbra and penumbra",
  }),
  earthDiameter: {
    value: 2 * PLANET_RADIUS_KM.earth,
    unit: "km",
    digits: 5,
    source: "iau2015b3",
    status: "derived",
    note: "twice the IAU mean radius, for the comparison",
  },
  field: literatureFact(SPOT_FIELD_T, "T", "solanki2003", "flag", {
    range: [0.2, 0.35],
    note: "an umbra's field",
  }),
} satisfies Facts;

const CHROMOSPHERE = {
  thickness: literatureFact(CHROMOSPHERE_THICKNESS_KM, "km", "priest2014", "flag"),
  temperatureMinimum: literatureFact(4_500, "K", "priest2014", "flag", { digits: 2 }),
  temperature: literatureFact(null, "K", "priest2014", "flag", { range: [4_500, 20_000] }),
  halpha: {
    value: HALPHA_NM,
    unit: "nm",
    digits: 5,
    source: "priest2014",
    status: "derived",
    note: "the Rydberg formula with hydrogen's reduced mass, in air",
  },
} satisfies Facts;

const CORONA = {
  temperature: literatureFact(null, "K", "aschwanden2005", "flag", { range: [1e6, 3e6] }),
  modelTemperature: literatureFact(TEMPERATURES.quietCorona, "K", "horizon", "teaching-choice", {
    note: "the quiet corona the model draws",
  }),
  greenLine: literatureFact(E_CORONA_LINE_NM, "nm", "priest2014", "flag", { note: "Fe XIV" }),
  greenLineTemperature: literatureFact(E_CORONA_KELVIN, "K", "priest2014", "flag"),
  kCoronaBase: {
    value: 1e-6 * kCorona(1),
    unit: "ratio",
    digits: 2,
    source: "baumbach1937",
    status: "derived",
    note: "the K-corona at the limb over the mean disc, from Baumbach's fit",
  },
  windSlow: literatureFact(WIND_SLOW_KM_S, "km/s", "mccomas2000", "flag", {
    note: "representative slow-wind speed near Earth's orbit; sources are diverse",
  }),
  windFast: literatureFact(WIND_FAST_KM_S, "km/s", "mccomas2000", "flag", {
    note: "representative fast-wind speed near Earth's orbit; coronal holes occur at multiple latitudes",
  }),
  sourceSurface: literatureFact(
    SOURCE_SURFACE_R,
    "Rsun",
    "altschulerNewkirk1969",
    "teaching-choice",
    {
      note: "chosen radial boundary for the global dipole only; added active-region dipoles do not satisfy that boundary",
    },
  ),
} satisfies Facts;

const FIELD = {
  loopTemperatures: literatureFact(null, "K", "reale2014", "flag", {
    range: LOOP_KELVIN_RANGE,
    note: "coronal loops from the quiet fans to active-region cores; the model's RTV rule is held within it",
  }),
  loopReferenceTemperature: literatureFact(
    LOOP_REFERENCE.kelvin,
    "K",
    "reale2014",
    "teaching-choice",
    {
      note: "a fan loop of 200 G plage footpoints and 200 Mm, the anchor of T ∝ (B² L)^(2/7)",
    },
  ),
  loopReferenceField: literatureFact(LOOP_REFERENCE.fieldT, "T", "reale2014", "teaching-choice", {
    show: "G",
    note: "the anchor loop's footpoint field",
  }),
  loopReferenceLength: {
    value: LOOP_REFERENCE.lengthR * RADIUS_M,
    unit: "m",
    show: "km",
    digits: 3,
    source: "reale2014",
    status: "teaching-choice",
    note: "the anchor loop's length",
  },
  equatorialDipole: literatureFact(
    100 * EQUATORIAL_DIPOLE,
    "percent",
    "deRosa2012",
    "teaching-choice",
    {
      note: "of the polar field at minimum: the equatorial dipole's strength at maximum, which opens low-latitude holes",
    },
  ),
  meanField: literatureFact(null, "T", "priest2014", "flag", {
    range: [1e-4, 1e-3],
    show: "mT",
    note: "the quiet Sun's large-scale field",
  }),
  polarField: literatureFact(POLAR_FIELD_T, "T", "hathaway2015", "flag", {
    range: [5e-4, 1.5e-3],
    show: "mT",
    note: "at minimum",
  }),
  spotField: SUNSPOT.field,
} satisfies Facts;

const ROTATION = {
  equatorPeriod: SUN.rotation,
  polePeriod: {
    value: surfacePeriod(Math.PI / 2),
    unit: "s",
    show: "d",
    digits: 3,
    source: "snodgrass1990",
    status: "derived",
    note: "the surface law at the pole",
  },
  carringtonPeriod: {
    value: (2 * Math.PI) / CARRINGTON_SIDEREAL_RATE,
    unit: "s",
    show: "d",
    digits: 4,
    source: "snodgrass1990",
    status: "derived",
    note: "conventional Carrington frame, 360° / 14.1844° per day (sidereal)",
  },
  interiorPeriod: {
    value: (2 * Math.PI) / INTERIOR_RATE,
    unit: "s",
    show: "d",
    digits: 3,
    source: "snodgrass1990",
    status: "teaching-choice",
    note: "a chosen rigid interior at the surface law's spherical mean; not a helioseismic core measurement",
  },
} satisfies Facts;

const CYCLE = {
  period: literatureFact(CYCLE_PERIOD_YR, "yr", "hathaway2015", "flag", { range: [9, 14] }),
  halePeriod: {
    value: 2 * CYCLE_PERIOD_YR,
    unit: "yr",
    digits: 2,
    source: "hathaway2015",
    status: "derived",
    note: "two sunspot cycles: the field returns to its sign",
  },
  rise: literatureFact(CYCLE_RISE_YR, "yr", "hathaway2015", "flag"),
  maunderLength: {
    value: MAUNDER_MINIMUM[1] - MAUNDER_MINIMUM[0],
    unit: "yr",
    digits: 2,
    source: "eddy1976",
    status: "derived",
    note: `${MAUNDER_MINIMUM[0]}–${MAUNDER_MINIMUM[1]}`,
  },
  maunderGroups: {
    value: meanOver(GROUP_NUMBERS, MAUNDER_MINIMUM),
    unit: "count",
    digits: 2,
    source: "svalgaardSchatten2016",
    status: "derived",
    note: "mean yearly group number through the Maunder minimum",
  },
  daltonLength: {
    value: DALTON_MINIMUM[1] - DALTON_MINIMUM[0],
    unit: "yr",
    digits: 2,
    source: "hathaway2015",
    status: "derived",
    note: `${DALTON_MINIMUM[0]}–${DALTON_MINIMUM[1]}`,
  },
  modernMaximumNumber: {
    value: meanOver(SUNSPOT_NUMBERS, MODERN_MAXIMUM),
    unit: "count",
    digits: 2,
    source: "silso",
    status: "derived",
    note: `mean yearly sunspot number ${MODERN_MAXIMUM[0]}–${MODERN_MAXIMUM[1]}`,
  },
  recordYearNumber: {
    value: peak(SUNSPOT_NUMBERS).number,
    unit: "count",
    digits: 3,
    source: "silso",
    status: "verified",
    note: `the record yearly mean, ${peak(SUNSPOT_NUMBERS).year}`,
  },
  sporerStart: literatureFact(SPORER_START_RAD, "rad", "hathaway2015", "teaching-choice", {
    show: "deg",
    digits: 2,
    note: "mean spot latitude as a cycle begins",
  }),
  sporerEnd: literatureFact(SPORER_END_RAD, "rad", "hathaway2015", "teaching-choice", {
    show: "deg",
    digits: 1,
    note: "mean spot latitude as it ends",
  }),
  joySlope: literatureFact(JOY_SLOPE, "ratio", "hathaway2015", "flag", {
    note: "a bipole's tilt over its latitude",
  }),
} satisfies Facts;

const ERUPTION = {
  flareIndex: literatureFact(FLARE_POWER_INDEX, "ratio", "aschwanden2005", "flag", {
    note: "dN/dF ∝ F^−α for the peak flux",
  }),
  cmeSpeed: {
    value:
      ((eruptionAt(1).cmeFront - eruptionAt(ERUPTION_STAGES.rise).cmeFront) * RADIUS_M) /
      ((1 - ERUPTION_STAGES.rise) * ERUPTION_SECONDS) /
      1e3,
    unit: "km/s",
    digits: 2,
    source: "horizon",
    status: "teaching-choice",
    note: "mean radial displacement from model rise stage to end, divided by the chosen event duration; includes display stretching, not an observed CME speed",
  },
} satisfies Facts;

/**
 * The map's active regions, as the NOAA/SWPC reports place them on the discs the mosaic is built
 * from: position, area (as a share of the hemisphere; the reports count millionths) and what the
 * set amounts to. Sizes and lifetimes follow from the areas by the model's usual rule.
 */
const OBSERVED = {
  set: {
    regions: {
      value: OBSERVED_REGIONS.length,
      unit: "count",
      source: "swpcSrs",
      status: "verified",
      note: `regions with spots of ${OBSERVED_MIN_AREA_MSH} millionths of a hemisphere or more on the four discs`,
    },
    mapWindow: literatureFact(MAP_WINDOW_D, "d", "swpcSrs", "verified", {
      note: "the HMI discs of 1, 8, 15 and 22 May 2024 the mosaic is built from",
    }),
    centralMeridian: {
      value: MAP_CENTRAL_MERIDIAN_DEG * RAD_PER_DEG,
      unit: "rad",
      show: "deg",
      digits: 3,
      source: "swpcSrs",
      status: "derived",
      note: "the Carrington longitude facing Earth at the map's epoch, 11 May 2024 12:00 UT: the model's longitude zero, from the reports' Lo − W at the Carrington synodic rate",
    },
  },
  ...recordFrom(
    OBSERVED_REGIONS.map((region) => `ar${region.number}`),
    (id) => {
      const region = OBSERVED_REGIONS.find((r) => `ar${r.number}` === id)!;
      return {
        latitude: {
          value: region.lat,
          unit: "rad",
          show: "deg",
          digits: 2,
          source: "swpcSrs",
          status: "verified",
          note: `NOAA ${region.number} on ${region.date.slice(0, 10)}`,
        },
        carringtonLongitude: {
          value: region.carringtonLon * RAD_PER_DEG,
          unit: "rad",
          show: "deg",
          digits: 3,
          source: "swpcSrs",
          status: "verified",
        },
        area: {
          value: region.areaMsh * 1e-6,
          unit: "ratio",
          digits: 2,
          source: "swpcSrs",
          status: "verified",
          note: `${region.areaMsh} millionths of a hemisphere; ${region.hale}`,
        },
      } satisfies Facts;
    },
  ),
} satisfies Record<string, Facts>;

/** Where each AIA band answers most, K (Lemen et al. 2012). */
const PASSBANDS = recordFrom(keysOf(AIA_PEAKS_K), (id) => {
  const peaks: readonly Peak[] = AIA_PEAKS_K[id];
  const [first, second] = peaks;
  const facts: { wavelength: Fact; temperature: Fact; secondaryTemperature?: Fact } = {
    wavelength: literatureFact(AIA_NM[id], "nm", "lemen2012", "verified", {
      show: "angstrom",
      digits: 3,
    }),
    temperature: literatureFact(first!.kelvin, "K", "lemen2012", "flag", {
      digits: 2,
      sources: ["boerner2012"],
      note: `${first!.ion}, representative log T = ${first!.logT}; approximate ion-response peak, not a unique formation temperature`,
    }),
  };
  if (second)
    facts.secondaryTemperature = literatureFact(second.kelvin, "K", "boerner2012", "flag", {
      digits: 2,
      sources: ["lemen2012"],
      note: `${second.ion}, representative log T = ${second.logT}; relative rendering weights and widths are teaching choices, not calibrated responses`,
    });
  return facts;
});

/** A spacecraft inside the corona: Parker Solar Probe at its closest approach. */
const PROBES = {
  parker: {
    perihelion: {
      value: PARKER_PERIHELION_R,
      unit: "Rsun",
      digits: 3,
      source: "nasaParker",
      status: "flag",
      note: "record orbit first reached 24 December 2024; radius from solar centre, not height above the photosphere",
    },
    speed: {
      value: PARKER_PERIHELION_SPEED_KM_S,
      unit: "km/s",
      digits: 3,
      source: "nasaParker",
      status: "flag",
      note: "approximate speed at the December 2024 perihelion",
    },
    aphelion: {
      value: PARKER_APHELION_R,
      unit: "Rsun",
      digits: 3,
      source: "horizonsParker",
      status: "derived",
      note: "from Horizons' perihelion and eccentricity: about 0.73 au, inside Venus's orbit",
    },
    shield: {
      value: PARKER_SHIELD_PERIHELION_C + 273.15,
      unit: "K",
      digits: 2,
      source: "nasaParkerShield",
      status: "flag",
      note: "about 2,500 °F (1,371 °C) on the sunward face at the closest passes; the lab scales it as r^−½ along the orbit",
    },
    coronaEdge: {
      value: PARKER_CORONA_EDGE_R,
      unit: "Rsun",
      digits: 3,
      source: "kasper2021",
      status: "flag",
      note: "first measured crossing below the Alfvén surface, the corona's outer edge; the surface itself is uneven and moves",
    },
    period: {
      value: PARKER_PERIOD_D,
      unit: "d",
      digits: 3,
      source: "horizonsParker",
      status: "flag",
      note: "osculating period, 1 June 2025",
    },
  },
} as const;

export const SUN_CATALOGUE = {
  /** The star as a body. */
  star: { body: BODY, rotation: ROTATION },
  /** Inside out. */
  layers: {
    interior: INTERIOR,
    photosphere: PHOTOSPHERE,
    chromosphere: CHROMOSPHERE,
    corona: CORONA,
  },
  /** What the field does. */
  activity: { sunspot: SUNSPOT, field: FIELD, cycle: CYCLE, eruption: ERUPTION },
  observed: OBSERVED,
  passbands: PASSBANDS,
  probes: PROBES,
} as const;

/** Every fact with its path ("layers.interior.centralTemperature"), for tests and the ledger. */
export const sunFacts = () => factsOf(SUN_CATALOGUE);

/**
 * The figures the lab's prose quotes, by placeholder, in the unit their sentences name:
 * "{coreTemperatureMK} million kelvin", "{photonWalkKyr} thousand years".
 */
export const PROSE_FIGURES = {
  coreTemperatureMK: quoteAs(INTERIOR.centralTemperature, { perPower: 6, digits: 3 }),
  centralDensity: INTERIOR.centralDensity,
  coreRadius: INTERIOR.coreRadius,
  tachocline: INTERIOR.tachocline,
  photonWalkKyr: quoteAs(INTERIOR.photonWalk, { in: "kyr", digits: 2 }),
  photonWalkLiteratureKyr: quoteAs(INTERIOR.photonWalkLiterature, { in: "kyr", digits: 2 }),
  lightTimeMin: quoteAs(BODY.lightTime, { in: "min", digits: 2 }),
  ppPercent: BODY.ppMassFraction,
  massLossKgPerSecond: quoteAs(BODY.massLoss, { style: "scientific", digits: 3 }),
  photosphereThicknessKm: PHOTOSPHERE.thickness,
  granuleKm: PHOTOSPHERE.granuleSize,
  granuleMin: PHOTOSPHERE.granuleLifetime,
  supergranuleKm: PHOTOSPHERE.supergranuleSize,
  umbraPercent: SUNSPOT.umbraIntensity,
  umbraKelvin: SUNSPOT.umbraTemperature,
  spotFieldT: SUNSPOT.field,
  chromosphereKm: CHROMOSPHERE.thickness,
  halphaNm: quoteAs(CHROMOSPHERE.halpha, { digits: 4 }),
  coronaMK: quoteAs(CORONA.temperature, { perPower: 6, digits: 1 }),
  meanFieldMT: quoteAs(FIELD.meanField, { in: "mT" }),
  equatorDays: quoteAs(ROTATION.equatorPeriod, { in: "d", digits: 3 }),
  poleDays: quoteAs(ROTATION.polePeriod, { in: "d", digits: 2 }),
  cycleYears: CYCLE.period,
  maunderYears: CYCLE.maunderLength,
  windSlowKmS: CORONA.windSlow,
  windFastKmS: CORONA.windFast,
} satisfies Record<string, ProseFigure>;
