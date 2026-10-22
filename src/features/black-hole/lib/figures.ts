/**
 * Every catalogue figure the observatory's tours, stories and atlas quote, by the placeholder
 * their messages use: the shared holes' masses and distances (`BLACK_HOLES`), the LMC's and
 * Andromeda's, and what follows from them through the science kit's laws (horizon sizes, the
 * M = 10 ruler, how M87* compares with Sgr A*). Plain figures print in the unit the sentence
 * names; the atlas's catalogue lines print with their unit, scientific where the lab always has.
 * The guide's equation lines are English throughout (`inLine`).
 */
import {
  factsOf,
  proseArgs,
  proseFacts,
  quoteAs,
  type Fact,
  type ProseFigure,
  type Value,
} from "@/lib/facts";
import { COSMOS } from "@/space/cosmos/model/catalogue";
import { BLACK_HOLES, NAMED_STARS } from "@/space/stellar";
import {
  PLANCK_2018,
  comovingDistanceMpc,
  convert,
  convertFigure,
  cosmicAgeAtRedshiftGyr,
  formatFigure,
  lookbackTimeGyr,
  SHADOW_PER_RS,
  SPEED_OF_LIGHT_KM_S,
  measure,
  schwarzschildRadius,
  type FigureOptions,
} from "@horizon/toolkit/science";

import { OBSERVATORY as OBS } from "./catalogue";

const SGR = BLACK_HOLES["sgr-a"];
const M87 = BLACK_HOLES.m87;
const CYG = BLACK_HOLES["cygnus-x1"];
const GAIA = BLACK_HOLES["gaia-bh3"];
const OMEGA = BLACK_HOLES["omega-cen"];
const TON = BLACK_HOLES["ton-618"];
const GW = BLACK_HOLES.gw231123;

/** A hole's Schwarzschild radius, km, for a mass in M☉. */
const horizonKm = (msun: number) =>
  schwarzschildRadius.measure({ M: measure(msun, "Msun") }).in("km");
const auOf = (km: number) => measure(km, "km").in("au");
/** The geometric length GM/c², half the Schwarzschild radius: the unit M of the lab's ruler. */
const gravitationalKm = (msun: number) => horizonKm(msun) / 2;
/** The lab's ruler is 10 M long. */
const RULER_M = 10;

/** A figure that follows from catalogued ones: the first's source, every input's cited. */
const derived = (value: number, unit: Value["unit"], digits: number, ...from: Fact[]): Value => ({
  value,
  unit,
  digits,
  source: from[0]!.source,
  sources: from.slice(1).map((fact) => fact.source),
  status: "derived",
});

const kpc = (fact: Value) => convertFigure(fact.value, fact.unit, "kpc");
const [TON_LOW, TON_HIGH] = TON.mass.range ?? [TON.mass.value, TON.mass.value];
const ANDROMEDA = COSMOS.andromeda.distance;
/** TON 618's redshift, and what Planck 2018's universe makes of it. */
const TON_Z = TON.redshift.value;
const cosmology = (value: number, unit: Value["unit"], digits: number): Value => ({
  ...derived(value, unit, digits, TON.redshift),
  sources: ["planck2018"],
});
const LMC = NAMED_STARS.r136a1.distance;

/** A non-spinning hole's shadow seen from `distance`, μas: twice b_c = SHADOW_PER_RS r_s, over D. */
const shadowUas = (mass: Value, distance: Value) =>
  derived(
    measure(
      (2 * SHADOW_PER_RS * horizonKm(mass.value)) /
        convertFigure(distance.value, distance.unit, "km"),
      "rad",
    ).in("uas"),
    "uas",
    2,
    mass,
    distance,
  );
/** A speed as a percentage of light's. */
const percentOfLight = (kms: number, digits: number, from: Fact) =>
  derived((100 * kms) / SPEED_OF_LIGHT_KM_S, "percent", digits, from);
/** A distance in kpc and ly as the atlas prints it. */
const kpcAndLy = (fact: Fact, kpcDigits: number, lyDigits: number) => ({
  kpc: quoteAs(fact, { in: "kpc", digits: kpcDigits }),
  ly: quoteAs(fact, { in: "ly", digits: lyDigits }),
});
const GRS = kpcAndLy(OBS.grs1915.distance, 2, 2);
const SS433 = kpcAndLy(OBS.ss433.distance, 2, 2);
const ORION = kpcAndLy(OBS.orion.distance, 2, 3);
const CARINA = kpcAndLy(OBS.carina.distance, 3, 2);
const CYGNUS_X = kpcAndLy(OBS.cygnusX.distance, 2, 2);
/** Westerlund 1 at its span's middle, for the "≈4 kpc" line. */
export const WD1_KPC = Math.sqrt(
  OBS.westerlund1.distance.range[0] * OBS.westerlund1.distance.range[1],
);
const WD1 = kpcAndLy(derived(WD1_KPC, "kpc", 1, OBS.westerlund1.distance), 1, 2);
/** GW150914's GW frequency at the ISCO: c³ / (6^{3/2} π G M_tot). */
const GW150914_ISCO_HZ =
  1 /
  (Math.PI *
    6 ** 1.5 *
    (gravitationalKm(OBS.gw150914.primaryMass.value + OBS.gw150914.secondaryMass.value) /
      SPEED_OF_LIGHT_KM_S));

export const PROSE_FIGURES = {
  sgrKpc: SGR.distance,
  sgrKpcShort: quoteAs(SGR.distance, { digits: 3 }),
  sgrLy: quoteAs(SGR.distance, { in: "ly", digits: 2 }),
  sgrMassMillions: quoteAs(SGR.mass, { perPower: 6, digits: 2 }),
  m87Mpc: M87.distance,
  m87Mly: quoteAs(M87.distance, { in: "Mly", digits: 3 }),
  m87MlyRound: quoteAs(M87.distance, { in: "Mly", digits: 2 }),
  m87MassBillions: quoteAs(M87.mass, { perPower: 9, digits: 2 }),
  m87FartherThanSgr: derived(
    kpc(M87.distance) / kpc(SGR.distance),
    "ratio",
    1,
    M87.distance,
    SGR.distance,
  ),
  m87FartherThanAndromeda: derived(
    kpc(M87.distance) / kpc(ANDROMEDA),
    "ratio",
    2,
    M87.distance,
    ANDROMEDA,
  ),
  m87HeavierThanSgr: derived(M87.mass.value / SGR.mass.value, "ratio", 2, M87.mass, SGR.mass),
  m87HorizonBillionKm: derived((2 * horizonKm(M87.mass.value)) / 1e9, "count", 2, M87.mass),
  m87HorizonAu: derived(auOf(2 * horizonKm(M87.mass.value)), "au", 2, M87.mass),
  cygKpc: CYG.distance,
  cygLy: quoteAs(CYG.distance, { in: "ly", digits: 3 }),
  cygMass: CYG.mass,
  cygMassRound: quoteAs(CYG.mass, { digits: 2 }),
  cygLighterThanSgr: derived(SGR.mass.value / CYG.mass.value, "ratio", 1, SGR.mass, CYG.mass),
  cygRulerKm: derived(RULER_M * gravitationalKm(CYG.mass.value), "km", 2, CYG.mass),
  sgrRulerMillionKm: derived(
    (RULER_M * gravitationalKm(SGR.mass.value)) / 1e6,
    "count",
    2,
    SGR.mass,
  ),
  gaiaMass: GAIA.mass,
  gaiaMassRound: quoteAs(GAIA.mass, { digits: 2 }),
  gaiaKpc: quoteAs(GAIA.distance, { in: "kpc", digits: 3 }),
  gaiaLy: quoteAs(GAIA.distance, { in: "ly", digits: 3 }),
  gaiaLyRound: quoteAs(GAIA.distance, { in: "ly", digits: 2 }),
  gaiaHorizonKm: derived(horizonKm(GAIA.mass.value), "km", 2, GAIA.mass),
  gaiaHorizonAcrossKm: derived(2 * horizonKm(GAIA.mass.value), "km", 2, GAIA.mass),
  omegaKpc: OMEGA.distance,
  omegaLy: quoteAs(OMEGA.distance, { in: "ly", digits: 3 }),
  omegaMass: OMEGA.mass,
  tonMassBillions: quoteAs(TON.mass, { span: true, perPower: 9, digits: 1 }),
  tonHorizonAu: {
    range: [auOf(horizonKm(TON_LOW)), auOf(horizonKm(TON_HIGH))],
    unit: "au",
    digits: 2,
    source: TON.mass.source,
    status: "derived",
  },
  gwMass: GW.mass,
  gwMassRound: quoteAs(GW.mass, { digits: 2 }),
  gwHorizonKm: derived(horizonKm(GW.mass.value), "km", 2, GW.mass),
  gwGpc: GW.distance,
  gwSpin: GW.spin,
  /* The outer horizon r₊ = (1 + √(1 − a²)) GM/c² at the measured spin. */
  gwKerrHorizonKm: derived(
    (1 + Math.sqrt(1 - GW.spin.value ** 2)) * gravitationalKm(GW.mass.value),
    "km",
    2,
    GW.mass,
    GW.spin,
  ),
  s2Years: quoteAs(SGR.companionPeriod, { digits: 2 }),
  s2PeriodYears: SGR.companionPeriod,
  s2PericentreAu: SGR.companionPericentre,
  s2PericentreRs: derived(
    convertFigure(SGR.companionPericentre.value, SGR.companionPericentre.unit, "km") /
      horizonKm(SGR.mass.value),
    "ratio",
    2,
    SGR.companionPericentre,
    SGR.mass,
  ),
  gaiaOrbitYears: GAIA.companionPeriod,
  gwPrimaryMass: GW.primaryMass,
  gwSecondaryMass: GW.secondaryMass,
  cygWindMass: CYG.massOtherModels,
  cygWindLowest: derived(CYG.massOtherModels.range[0], "Msun", 2, CYG.massOtherModels),
  tonRedshift: TON.redshift,
  tonRedshiftShort: quoteAs(TON.redshift, { digits: 3 }),
  tonLightGyr: cosmology(lookbackTimeGyr(TON_Z, PLANCK_2018), "Gyr", 3),
  tonComovingBillionLy: cosmology(
    convert(comovingDistanceMpc(TON_Z, PLANCK_2018), "Mpc", "ly") / 1e9,
    "count",
    2,
  ),
  tonUniverseThenGyr: cosmology(cosmicAgeAtRedshiftGyr(TON_Z, PLANCK_2018), "Gyr", 1),
  universeGyr: COSMOS.universe.age,
  andromedaKpc: quoteAs(ANDROMEDA, { in: "kpc", digits: 3 }),
  andromedaMly: quoteAs(ANDROMEDA, { digits: 2 }),
  lmcKpc: LMC,
  lmcLy: quoteAs(LMC, { in: "ly", digits: 3 }),
  sgrRing: quoteAs(OBS.sgrA.ring, { digits: 2 }),
  sgrRingPrecise: OBS.sgrA.ring,
  sgrShadowUas: shadowUas(SGR.mass, SGR.distance),
  s2SpeedPercent: percentOfLight(OBS.s2.pericentreSpeed.value, 2, OBS.s2.pericentreSpeed),
  s301PericentreAu: OBS.s301.pericentre,
  s301SpeedPercent: percentOfLight(OBS.s301.pericentreSpeed.range[0], 1, OBS.s301.pericentreSpeed),
  m87JetDeg: OBS.m87.jetAngle,
  m87Ring: OBS.m87.ring,
  m87RingRound: quoteAs(OBS.m87.ring, { digits: 2 }),
  m87ShadowUas: shadowUas(M87.mass, M87.distance),
  gaiaEccentricity: quoteAs(OBS.gaiaBh3.eccentricity, { digits: 2 }),
  gaiaSeparationAu: OBS.gaiaBh3.separation,
  omegaTrackedMillions: quoteAs(OBS.omegaCen.trackedStars, { perPower: 6, digits: 2 }),
  omegaImages: OBS.omegaCen.images,
  omegaFastestKms: OBS.omegaCen.fastestStar,
  omegaEscapeKms: OBS.omegaCen.escapeSpeed,
  omegaModelMass: OBS.omegaCen.modelMass,
  omegaLimitAgainst: OBS.omegaCen.massLimitAgainst,
  tonLineKms: OBS.ton618.lineWidth,
  tonLimitBillions: quoteAs(OBS.ton618.thinDiskLimit, { perPower: 9, digits: 2 }),
  gwFrequenciesHz: OBS.gw231123.frequencies,
  gwDurationS: OBS.gw231123.duration,
  gwSkyDeg2: OBS.gw231123.skyArea,
  gwRedshift: OBS.gw231123.redshift,
  gwTravelGyr: OBS.gw231123.travelTime,
  gwPrimarySpin: OBS.gw231123.primarySpin,
  gwSecondarySpin: OBS.gw231123.secondarySpin,
  gwGapMsun: OBS.gw231123.pairInstabilityGap,
  gw150914Primary: OBS.gw150914.primaryMass,
  gw150914Secondary: OBS.gw150914.secondaryMass,
  gw150914BillionLy: quoteAs(OBS.gw150914.distance, { perPower: 9, digits: 2 }),
  gw150914Radiated: OBS.gw150914.radiated,
  gw150914IscoHz: derived(GW150914_ISCO_HZ, "Hz", 1, OBS.gw150914.primaryMass),
  /* The same frequency for one solar mass, kHz: c³ / (6^{3/2} π G M☉). */
  iscoKhzPerMsun: derived(
    1 / (Math.PI * 6 ** 1.5 * (gravitationalKm(1) / SPEED_OF_LIGHT_KM_S)) / 1e3,
    "count",
    2,
    OBS.gw150914.primaryMass,
  ),
  m87Ring2019Round: quoteAs(OBS.m87.ring2019, { digits: 2 }),
  grsKpc: GRS.kpc,
  grsLy: GRS.ly,
  grsMass: OBS.grs1915.mass,
  ss433Kpc: SS433.kpc,
  ss433Ly: SS433.ly,
  ss433JetC: OBS.ss433.jetSpeed,
  orionKpc: ORION.kpc,
  orionLy: ORION.ly,
  carinaKpc: CARINA.kpc,
  carinaLy: CARINA.ly,
  etaCarinaeMass: OBS.carina.etaCarinaeMass,
  cygnusXKpc: CYGNUS_X.kpc,
  cygnusXLy: CYGNUS_X.ly,
  wd1Span: OBS.westerlund1.distance,
  wd1Kpc: WD1.kpc,
  wd1Ly: WD1.ly,
  wd1Mass: OBS.westerlund1.mass,
  lmcX1Mass: OBS.lmc.x1Mass,
  /* The atlas's catalogue lines: with their unit, scientific or with their error. */
  sgrMassSci: quoteAs(SGR.mass, { style: "scientific", withUnit: true }),
  m87MassSci: quoteAs(M87.mass, { style: "scientific", withUnit: true }),
  cygMassError: quoteAs(CYG.mass, { style: "error", withUnit: true }),
  gaiaMassError: quoteAs(GAIA.mass, { style: "error", withUnit: true }),
  tonMassSci: quoteAs(TON.mass, { style: "scientific", span: true, digits: 2, withUnit: true }),
  m87RingError: quoteAs(OBS.m87.ring, { style: "error", withUnit: true }),
  m87Ring2019Error: quoteAs(OBS.m87.ring2019, { style: "error" }),
  omegaClusterSci: quoteAs(OBS.omegaCen.clusterMass, {
    style: "scientific",
    digits: 1,
    withUnit: true,
  }),
  m31HoleSci: quoteAs(OBS.m31.holeMass, { style: "scientific", withUnit: true }),
} satisfies Record<string, ProseFigure>;

/** Every placeholder's text in a language, and its plural category, for `t()`. */
export const figureArgs = (locale: string) => proseArgs(PROSE_FIGURES, locale);

/**
 * A figure as the guide's equation lines print it: English, with its unit, scientific from
 * 10⁵ ("4.297 × 10⁶ M☉"), and with any other way of printing it (`FigureOptions`).
 */
export const inLine = (fact: Fact, as: FigureOptions = {}) =>
  formatFigure("en", fact, { style: "scientific", withUnit: true, ...as }).text;

export const catalogueFacts = () => factsOf({ blackHole: { prose: proseFacts(PROSE_FIGURES) } });
