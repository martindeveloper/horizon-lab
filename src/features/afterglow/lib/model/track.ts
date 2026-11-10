/**
 * The Sun's evolutionary track as a sparse, sourced table: age since the first solids, the
 * luminosity, effective temperature and mass at each row. Schröder & Smith (2008, Table 1)
 * carry the Sun from the zero-age main sequence to the AGB tip with their mass loss; Sackmann,
 * Boothroyd & Kraemer (1993) give the same start; the rows between the table's are a sketch of
 * the climb, drawn to Schröder & Smith's statement that the final ascent sweeps the inner
 * planets in five million years; Miller Bertolami (2016) times the crossing to the nebula's
 * star (his Table 3, between the rows either side of the remnant's mass), and the Montreal
 * cooling sequences (0.5 M☉, the nearest to the 0.5405 M☉ remnant) the white dwarf's fade.
 * Between rows the track interpolates linearly in age, and in the logarithm of the time since
 * the envelope left where the clock runs fast.
 */
import type { Status } from "@/lib/facts";
import type { SourceId } from "@/lib/sources";
import { SUN_BIRTH } from "@/space/solar-system/model/parameters";
import { SOLAR_TEFF_K, convert, stefanBoltzmann } from "@horizon/toolkit/science";

export type Phase =
  | "mainSequence"
  | "subgiant"
  | "redGiant"
  | "heliumBurning"
  | "agb"
  | "postAgb"
  | "whiteDwarf";

export type TrackRow = {
  id: string;
  /** Years since the first solids; the zero-age main sequence is within the first few tens of Myr. */
  age: number;
  /** L☉. */
  luminosity: number;
  /** K. */
  teff: number;
  /** M☉. */
  mass: number;
  phase: Phase;
  source: SourceId;
  sources?: readonly SourceId[];
  status: Status;
  note?: string;
};

const GYR = 1e9;
const MYR = 1e6;

/** Today: the first solids' age. */
export const TODAY = SUN_BIRTH;
/** The core's hydrogen runs out (Schröder & Smith 2008, Table 1: MS:final). */
export const MS_END = 10.0 * GYR;
/** The red-giant tip (Schröder & Smith 2008: 12.167 Gy). */
export const RGB_TIP = 12.167 * GYR;
/** The final ascent sweeps through the inner planets within this long before the tip (Schröder & Smith 2008). */
export const SWEEP = 5 * MYR;
/** Earth is engulfed by tides and drag this long before the tip (Schröder & Smith 2008, Fig. 2). */
export const EARTH_ENGULFED_BEFORE_TIP = 0.5 * MYR;
/** Venus and Mercury meet the same fate this long before Earth (Schröder & Smith 2008, section 4.3). */
export const VENUS_BEFORE_EARTH = 1.0 * MYR;
export const MERCURY_BEFORE_EARTH = 3.8 * MYR;
/** Core helium burning begins (Schröder & Smith 2008, Table 1: ZA-He). */
export const HELIUM_START = 12.17 * GYR;
/** How long core helium burning lasts: Schröder & Smith's 130 Myr, Miller Bertolami's ~100 Myr. */
export const HELIUM_YEARS = 110 * MYR;
export const HELIUM_END = HELIUM_START + HELIUM_YEARS;
/** The AGB tip (Schröder & Smith 2008, Table 1). */
export const AGB_TIP = 12.3 * GYR;
/** The final 30,000 y on the very tip of the AGB, then the last thermal pulse and 1,300 years of wind (Schröder & Smith 2008). */
export const FINAL_PULSE = AGB_TIP + 30_000;
export const AGB_END = FINAL_PULSE + 1_300;
/** The white dwarf's final mass (Schröder & Smith 2008). */
export const DWARF_MASS = 0.5405;
/**
 * Miller Bertolami (2016, Table 3, Z₀ = 0.02): the remnants either side of the Sun's (from 1.00
 * and 1.25 M☉ stars) and their τcross, the years the bare star takes from log Teff = 3.85 to
 * its hottest. It times the star, not how long a nebula glows.
 */
const CROSSINGS = [
  { mass: 0.5281, years: 24_900 },
  { mass: 0.5615, years: 5_970 },
] as const;
/** The crossing to the nebula's hot star: τcross at the remnant's mass, between the table's rows in the logarithm of the time. */
export const NEBULA_YEARS = (() => {
  const [light, heavy] = CROSSINGS;
  const f = (DWARF_MASS - light.mass) / (heavy.mass - light.mass);
  return Math.exp(Math.log(light.years) + f * Math.log(heavy.years / light.years));
})();
export const NEBULA_END = AGB_END + NEBULA_YEARS;
/** The fade from the crossing's plateau onto the cooling track, at near-constant temperature: drawn. */
const FADE_YEARS = 30_000;
/** Where the white dwarf's cooling sequence begins. */
export const COOLING_START = NEBULA_END + FADE_YEARS;

/** A Montreal cooling-sequence row (0.5 M☉, thick hydrogen layer): temperature, radius and cooling age. */
type CoolingRow = { id: string; teff: number; radiusCm: number; age: number };
const COOLING: readonly CoolingRow[] = [
  { id: "cooling72k", teff: 71_977, radiusCm: 1.694e9, age: 0 },
  { id: "cooling60k", teff: 60_813, radiusCm: 1.548e9, age: 1.6e5 },
  { id: "cooling40k", teff: 40_101, radiusCm: 1.259e9, age: 2.888e6 },
  { id: "cooling30k", teff: 29_989, radiusCm: 1.157e9, age: 8.01e6 },
  { id: "cooling20k", teff: 20_087, radiusCm: 1.074e9, age: 3.751e7 },
  { id: "cooling15k", teff: 15_011, radiusCm: 1.038e9, age: 1.391e8 },
  { id: "cooling10k", teff: 9_967, radiusCm: 1.002e9, age: 5.096e8 },
  { id: "cooling8k", teff: 8_011, radiusCm: 9.884e8, age: 8.978e8 },
  { id: "cooling6k", teff: 6_035, radiusCm: 9.728e8, age: 1.834e9 },
  { id: "cooling5k", teff: 4_994, radiusCm: 9.537e8, age: 4.127e9 },
  { id: "cooling4k", teff: 3_984, radiusCm: 9.449e8, age: 8.269e9 },
  { id: "cooling3k", teff: 3_472, radiusCm: 9.434e8, age: 9.593e9 },
];

/** A cooling row's luminosity, by Stefan–Boltzmann from its radius and temperature. */
const coolingLuminosity = ({ teff, radiusCm }: CoolingRow) =>
  stefanBoltzmann.compute({ R: convert(radiusCm / 100, "m", "Rsun"), T: teff });

const SS08: Pick<TrackRow, "source" | "status"> = { source: "schroder2008", status: "verified" };
const SKETCH: Pick<TrackRow, "source" | "status"> = {
  source: "schroder2008",
  status: "teaching-choice",
};

export const TRACK: readonly TrackRow[] = [
  {
    id: "zams",
    age: 0,
    luminosity: 0.7,
    teff: 5596,
    mass: 1,
    phase: "mainSequence",
    ...SS08,
    sources: ["sackmann1993"],
    note: "the zero-age main sequence, 0.70 L☉ in both Schröder & Smith and Sackmann et al.",
  },
  {
    id: "today",
    age: TODAY,
    luminosity: 1,
    teff: SOLAR_TEFF_K,
    mass: 1,
    phase: "mainSequence",
    ...SS08,
    note: "the table's present, 4.58 Gy; the clock counts from the first solids, 4.567 Gyr ago",
  },
  {
    id: "hottest",
    age: 7.13 * GYR,
    luminosity: 1.26,
    teff: 5820,
    mass: 1,
    phase: "mainSequence",
    ...SS08,
    note: "MS:hottest",
  },
  {
    id: "msEnd",
    age: MS_END,
    luminosity: 1.84,
    teff: 5751,
    mass: 1,
    phase: "mainSequence",
    ...SS08,
    note: "MS:final, the core's hydrogen gone",
  },
  {
    id: "subgiant",
    age: 11.6 * GYR,
    luminosity: 2.7,
    teff: 5150,
    mass: 1,
    phase: "subgiant",
    ...SKETCH,
    sources: ["sackmann1993"],
    note: "sketch of the subgiant branch between the table's rows; Sackmann et al. reach 2.2 L☉ 6.5 Gyr from now",
  },
  {
    id: "rgbBase",
    age: 12.0 * GYR,
    luminosity: 25,
    teff: 4600,
    mass: 0.99,
    phase: "redGiant",
    ...SKETCH,
    note: "sketch of the climb's base",
  },
  {
    id: "rgbRise",
    age: 12.1 * GYR,
    luminosity: 250,
    teff: 3900,
    mass: 0.95,
    phase: "redGiant",
    ...SKETCH,
    note: "sketch of the climb",
  },
  {
    id: "rgbSweep",
    age: RGB_TIP - SWEEP,
    luminosity: 700,
    teff: 3150,
    mass: 0.85,
    phase: "redGiant",
    source: "schroder2008",
    status: "derived",
    note: "the final ascent sweeps the inner planets within 5 Myr: Mercury's orbit reached here",
  },
  {
    id: "rgbTip",
    age: RGB_TIP,
    luminosity: 2730,
    teff: 2602,
    mass: 0.668,
    phase: "redGiant",
    ...SS08,
    note: "RGB:tip, R = 256 R☉",
  },
  {
    id: "heliumStart",
    age: HELIUM_START,
    luminosity: 53.7,
    teff: 4667,
    mass: 0.668,
    phase: "heliumBurning",
    ...SS08,
    note: "ZA-He, R = 11.2 R☉",
  },
  {
    id: "heliumEnd",
    age: HELIUM_END,
    luminosity: 60,
    teff: 4600,
    mass: 0.668,
    phase: "heliumBurning",
    ...SKETCH,
    sources: ["millerBertolami2016"],
    note: "core helium burning held for 110 Myr (Schröder & Smith: 130; Miller Bertolami: about 100)",
  },
  {
    id: "agbEarly",
    age: 12.295 * GYR,
    luminosity: 400,
    teff: 3700,
    mass: 0.6,
    phase: "agb",
    ...SKETCH,
    note: "sketch of the early AGB",
  },
  {
    id: "agbTip",
    age: AGB_TIP,
    luminosity: 2090,
    teff: 3200,
    mass: 0.546,
    phase: "agb",
    ...SS08,
    note: "AGB:tip, R = 149 R☉",
  },
  {
    id: "finalPulse",
    age: FINAL_PULSE,
    luminosity: 4170,
    teff: 3467,
    mass: 0.544,
    phase: "agb",
    ...SS08,
    note: "AGB:tip-TP, the last thermal pulse, R = 179 R☉",
  },
  {
    id: "envelopeGone",
    age: AGB_END,
    luminosity: 3200,
    teff: 6000,
    mass: DWARF_MASS,
    phase: "postAgb",
    ...SKETCH,
    sources: ["millerBertolami2016"],
    note: "1,300 years of wind after the last pulse leave the 0.5405 M☉ core; the crossing begins at near-constant luminosity",
  },
  {
    id: "nebula",
    age: NEBULA_END,
    luminosity: 2500,
    teff: COOLING[0]!.teff,
    mass: DWARF_MASS,
    phase: "postAgb",
    source: "millerBertolami2016",
    sources: ["bergeronCooling"],
    status: "derived",
    note: "the crossing's end: τcross at 0.5405 M☉, log-interpolated between Table 3's Z₀ = 0.02 rows (24.9 kyr at 0.5281 M☉, 5.97 kyr at 0.5615 M☉); the temperature is the cooling sequence's first, the least the star's hottest can be: it cools onto that sequence, and the paper tabulates no peak",
  },
  ...COOLING.map((row, index): TrackRow => ({
    id: row.id,
    age: COOLING_START + row.age,
    luminosity: coolingLuminosity(row),
    teff: row.teff,
    mass: DWARF_MASS,
    phase: "whiteDwarf",
    source: "bergeronCooling",
    status: index === 0 ? "teaching-choice" : "derived",
    note:
      index === 0
        ? "the fade onto the cooling track, 30 kyr at near-constant temperature: drawn; the 0.5 M☉ sequence stands for the 0.5405 M☉ remnant"
        : "L = R² (T/T☉)⁴ from the sequence's radius and temperature",
  })),
];

/** The last moment the track reaches. */
export const END_AGE = TRACK[TRACK.length - 1]!.age;

/** The floor of the logarithmic clock after the envelope leaves, years. */
const FAST_FLOOR = 100;

/** Where a moment stands on the fast clock: the logarithm of the time since the envelope left. */
const fastTime = (age: number) => Math.log(Math.max(age - AGB_END, 0) + FAST_FLOOR);

export type TrackPoint = { luminosity: number; teff: number; mass: number; phase: Phase };

/** The track between its rows: log-linear in light and temperature, linear in mass. */
export function trackAt(age: number): TrackPoint {
  const t = Math.min(Math.max(age, 0), END_AGE);
  let i = 0;
  while (i < TRACK.length - 2 && t >= TRACK[i + 1]!.age) i += 1;
  const a = TRACK[i]!;
  const b = TRACK[i + 1]!;
  const fast = a.age >= AGB_END;
  const x = fast ? fastTime(t) : t;
  const x0 = fast ? fastTime(a.age) : a.age;
  const x1 = fast ? fastTime(b.age) : b.age;
  const f = x1 > x0 ? Math.min(1, Math.max(0, (x - x0) / (x1 - x0))) : 0;
  const mix = (p: number, q: number) => p + (q - p) * f;
  return {
    luminosity: Math.exp(mix(Math.log(a.luminosity), Math.log(b.luminosity))),
    teff: Math.exp(mix(Math.log(a.teff), Math.log(b.teff))),
    mass: mix(a.mass, b.mass),
    phase: a.phase,
  };
}
