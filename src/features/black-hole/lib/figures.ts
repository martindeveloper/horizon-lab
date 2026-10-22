/**
 * Every catalogue figure the observatory's tours, stories and atlas quote, by the placeholder
 * their messages use: the shared holes' masses and distances (`BLACK_HOLES`), the LMC's and
 * Andromeda's, and what follows from them through the science kit's laws (horizon sizes, the
 * M = 10 ruler, how M87* compares with Sgr A*). Plain figures print in the unit the sentence
 * names; the atlas's catalogue lines print with their unit, scientific where the lab always has.
 */
import { factsOf, inPowerOfTen, proseArgs, type Fact, type Span, type Value } from "@/lib/facts";
import { COSMOS } from "@/space/cosmos/model/catalogue";
import { BLACK_HOLES, NAMED_STARS } from "@/space/stellar";
import {
  PLANCK_2018,
  comovingDistanceMpc,
  convert,
  convertFigure,
  cosmicAgeAtRedshiftGyr,
  lookbackTimeGyr,
  SHADOW_PER_RS,
  SPEED_OF_LIGHT_KM_S,
  measure,
  schwarzschildRadius,
} from "@horizon/toolkit/science";

import { OBSERVATORY as OBS } from "./catalogue";
import { quote, quoteError, quoteSpan } from "./quote";

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
/** A figure's published span alone, for prose that quotes the whole spread. */
const spanOf = ({ value, range, ...rest }: Value): Span => ({
  ...rest,
  range: range ?? [value, value],
});
const [TON_LOW, TON_HIGH] = spanOf(TON.mass).range;
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
  kpc: { ...fact, show: "kpc" as const, digits: kpcDigits },
  ly: { ...fact, show: "ly" as const, digits: lyDigits },
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
  sgrKpcShort: { ...SGR.distance, digits: 3 },
  sgrLy: { ...SGR.distance, show: "ly", digits: 2 },
  sgrMassMillions: inPowerOfTen(SGR.mass, 6, 2),
  m87Mpc: M87.distance,
  m87Mly: { ...M87.distance, show: "Mly", digits: 3 },
  m87MlyRound: { ...M87.distance, show: "Mly", digits: 2 },
  m87MassBillions: inPowerOfTen(M87.mass, 9, 2),
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
  cygLy: { ...CYG.distance, show: "ly", digits: 3 },
  cygMass: CYG.mass,
  cygMassRound: { ...CYG.mass, digits: 2 },
  cygLighterThanSgr: derived(SGR.mass.value / CYG.mass.value, "ratio", 1, SGR.mass, CYG.mass),
  cygRulerKm: derived(RULER_M * gravitationalKm(CYG.mass.value), "km", 2, CYG.mass),
  sgrRulerMillionKm: derived(
    (RULER_M * gravitationalKm(SGR.mass.value)) / 1e6,
    "count",
    2,
    SGR.mass,
  ),
  gaiaMass: GAIA.mass,
  gaiaMassRound: { ...GAIA.mass, digits: 2 },
  gaiaKpc: { ...GAIA.distance, show: "kpc", digits: 3 },
  gaiaLy: { ...GAIA.distance, show: "ly", digits: 3 },
  gaiaLyRound: { ...GAIA.distance, show: "ly", digits: 2 },
  gaiaHorizonKm: derived(horizonKm(GAIA.mass.value), "km", 2, GAIA.mass),
  gaiaHorizonAcrossKm: derived(2 * horizonKm(GAIA.mass.value), "km", 2, GAIA.mass),
  omegaKpc: OMEGA.distance,
  omegaLy: { ...OMEGA.distance, show: "ly", digits: 3 },
  omegaMass: OMEGA.mass,
  tonMassBillions: inPowerOfTen(spanOf(TON.mass), 9, 1),
  tonHorizonAu: {
    range: [auOf(horizonKm(TON_LOW)), auOf(horizonKm(TON_HIGH))],
    unit: "au",
    digits: 2,
    source: TON.mass.source,
    status: "derived",
  },
  gwMass: GW.mass,
  gwMassRound: { ...GW.mass, digits: 2 },
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
  s2Years: { ...SGR.companionPeriod, digits: 2 },
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
  cygWindLowest: { ...CYG.massOtherModels, value: CYG.massOtherModels.range[0], digits: 2 },
  tonRedshift: TON.redshift,
  tonRedshiftShort: { ...TON.redshift, digits: 3 },
  tonLightGyr: cosmology(lookbackTimeGyr(TON_Z, PLANCK_2018), "Gyr", 3),
  tonComovingBillionLy: cosmology(
    convert(comovingDistanceMpc(TON_Z, PLANCK_2018), "Mpc", "ly") / 1e9,
    "count",
    2,
  ),
  tonUniverseThenGyr: cosmology(cosmicAgeAtRedshiftGyr(TON_Z, PLANCK_2018), "Gyr", 1),
  universeGyr: COSMOS.universe.age,
  andromedaKpc: { ...ANDROMEDA, show: "kpc", digits: 3 },
  andromedaMly: { ...ANDROMEDA, digits: 2 },
  lmcKpc: LMC,
  lmcLy: { ...LMC, show: "ly", digits: 3 },
  sgrRing: { ...OBS.sgrA.ring, digits: 2 },
  sgrRingPrecise: OBS.sgrA.ring,
  sgrShadowUas: shadowUas(SGR.mass, SGR.distance),
  s2SpeedPercent: percentOfLight(OBS.s2.pericentreSpeed.value, 2, OBS.s2.pericentreSpeed),
  s301PericentreAu: OBS.s301.pericentre,
  s301SpeedPercent: percentOfLight(OBS.s301.pericentreSpeed.range[0], 1, OBS.s301.pericentreSpeed),
  m87JetDeg: OBS.m87.jetAngle,
  m87Ring: OBS.m87.ring,
  m87RingRound: { ...OBS.m87.ring, digits: 2 },
  m87ShadowUas: shadowUas(M87.mass, M87.distance),
  gaiaEccentricity: { ...OBS.gaiaBh3.eccentricity, digits: 2 },
  gaiaSeparationAu: OBS.gaiaBh3.separation,
  omegaTrackedMillions: inPowerOfTen(OBS.omegaCen.trackedStars, 6, 2),
  omegaImages: OBS.omegaCen.images,
  omegaFastestKms: OBS.omegaCen.fastestStar,
  omegaEscapeKms: OBS.omegaCen.escapeSpeed,
  omegaModelMass: OBS.omegaCen.modelMass,
  omegaLimitAgainst: OBS.omegaCen.massLimitAgainst,
  tonLineKms: OBS.ton618.lineWidth,
  tonLimitBillions: inPowerOfTen(OBS.ton618.thinDiskLimit, 9, 2),
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
  gw150914BillionLy: inPowerOfTen(OBS.gw150914.distance, 9, 2),
  gw150914Radiated: OBS.gw150914.radiated,
  gw150914IscoHz: derived(GW150914_ISCO_HZ, "Hz", 1, OBS.gw150914.primaryMass),
  /* The same frequency for one solar mass, kHz: c³ / (6^{3/2} π G M☉). */
  iscoKhzPerMsun: derived(
    1 / (Math.PI * 6 ** 1.5 * (gravitationalKm(1) / SPEED_OF_LIGHT_KM_S)) / 1e3,
    "count",
    2,
    OBS.gw150914.primaryMass,
  ),
  m87Ring2019Round: { ...OBS.m87.ring2019, digits: 2 },
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
} satisfies Record<string, Fact>;

/** The atlas's catalogue lines: figures with their unit, scientific or with their error. */
const quoted = (locale: string) => ({
  sgrMassSci: quote(SGR.mass, locale),
  m87MassSci: quote(M87.mass, locale),
  cygMassError: quoteError(CYG.mass, locale),
  gaiaMassError: quoteError(GAIA.mass, locale),
  tonMassSci: quoteSpan(TON.mass, locale),
  m87RingError: quoteError(OBS.m87.ring, locale),
  m87Ring2019Error: quoteError(OBS.m87.ring2019, locale, false),
  omegaClusterSci: quote({ ...OBS.omegaCen.clusterMass, digits: 1 }, locale),
  m31HoleSci: quote(OBS.m31.holeMass, locale),
});

const cache = new Map<string, Record<string, string>>();

/** Every placeholder's text in a language, for `t()`. */
export function figureArgs(locale: string) {
  let args = cache.get(locale);
  if (!args) cache.set(locale, (args = { ...proseArgs(PROSE_FIGURES, locale), ...quoted(locale) }));
  return args;
}

/** Every figure, for tests. */
export const catalogueFacts = () => factsOf({ blackHole: { prose: PROSE_FIGURES } });
