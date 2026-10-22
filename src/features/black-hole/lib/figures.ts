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
import { convertFigure, measure, schwarzschildRadius } from "@horizon/toolkit/science";

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
const LMC = NAMED_STARS.r136a1.distance;

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
  lmcKpc: LMC,
  lmcLy: { ...LMC, show: "ly", digits: 3 },
} satisfies Record<string, Fact>;

/** The atlas's catalogue lines: figures with their unit, scientific or with their error. */
const quoted = (locale: string) => ({
  sgrMassSci: quote(SGR.mass, locale),
  m87MassSci: quote(M87.mass, locale),
  cygMassError: quoteError(CYG.mass, locale),
  gaiaMassError: quoteError(GAIA.mass, locale),
  tonMassSci: quoteSpan(TON.mass, locale),
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
