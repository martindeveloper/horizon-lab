/**
 * Units by dimension, each as a factor to its SI base (m, s, rad, rad/s, kg, m/s, m/s², K, J, W).
 * Symbols follow the SI and the IAU (au, ly, pc, M☉); hosts may translate them
 * for display. Astronomical definitions are exact where the IAU fixed them.
 */

import {
  AU_SI,
  EARTH_GM_SI,
  ELEMENTARY_CHARGE_SI,
  GRAVITATIONAL_CONSTANT_SI,
  JULIAN_YEAR_SI,
  SOLAR_GM_SI,
  SOLAR_LUMINOSITY_SI,
  SOLAR_RADIUS_SI,
  SPEED_OF_LIGHT_SI,
} from "./definitions";

export type Dimension =
  | "length"
  | "time"
  | "angle"
  | "angularRate"
  | "mass"
  | "speed"
  | "acceleration"
  | "rate"
  | "temperature"
  | "energy"
  | "power";

export type UnitDefinition = {
  dimension: Dimension;
  /** Display symbol (SI / IAU). */
  symbol: string;
  /** The same symbol for LaTeX. */
  latex: string;
  /** Multiply a value in this unit by `factor` to get the SI base unit. */
  factor: number;
};

const unit = (dimension: Dimension, symbol: string, factor: number, latex?: string) => ({
  dimension,
  symbol,
  factor,
  latex: latex ?? `\\mathrm{${symbol}}`,
});

const C = SPEED_OF_LIGHT_SI;
const YEAR = JULIAN_YEAR_SI;
const AU = AU_SI;
/** Parsec, m (exactly 648 000/π au, IAU 2015 Resolution B2). */
const PC = (648_000 / Math.PI) * AU;

export const UNITS = {
  // Length
  /** Ångström, the spectroscopist's traditional unit of wavelength. */
  angstrom: unit("length", "Å", 1e-10, "\\mathring{A}"),
  nm: unit("length", "nm", 1e-9),
  m: unit("length", "m", 1),
  km: unit("length", "km", 1e3),
  /** Nominal solar radius (IAU 2015 Resolution B3). */
  Rsun: unit("length", "R☉", SOLAR_RADIUS_SI, "R_\\odot"),
  au: unit("length", "au", AU),
  /** Julian light-year: light's path in 365.25 days. */
  ly: unit("length", "ly", C * YEAR),
  /** A million light-years, the usual unit for galaxies beyond the Local Group. */
  Mly: unit("length", "Mly", 1e6 * C * YEAR),
  pc: unit("length", "pc", PC),
  kpc: unit("length", "kpc", 1e3 * PC),
  Mpc: unit("length", "Mpc", 1e6 * PC),
  Gpc: unit("length", "Gpc", 1e9 * PC),
  // Time
  ms: unit("time", "ms", 1e-3),
  s: unit("time", "s", 1),
  min: unit("time", "min", 60),
  h: unit("time", "h", 3_600),
  d: unit("time", "d", 86_400),
  yr: unit("time", "yr", YEAR),
  kyr: unit("time", "kyr", 1e3 * YEAR),
  Myr: unit("time", "Myr", 1e6 * YEAR),
  Gyr: unit("time", "Gyr", 1e9 * YEAR),
  /** Julian century, the time unit of the planetary elements. */
  cy: unit("time", "cy", 100 * YEAR),
  // Angle
  rad: unit("angle", "rad", 1),
  deg: unit("angle", "°", Math.PI / 180, "^\\circ"),
  arcmin: unit("angle", "′", Math.PI / 10_800, "'"),
  arcsec: unit("angle", "″", Math.PI / 648_000, "''"),
  mas: unit("angle", "mas", Math.PI / 648_000_000),
  // Angular rate (proper motion)
  "arcsec/yr": unit("angularRate", "″/yr", Math.PI / 648_000 / YEAR, "''\\,\\mathrm{yr^{-1}}"),
  "mas/yr": unit("angularRate", "mas/yr", Math.PI / 648_000_000 / YEAR, "\\mathrm{mas\\,yr^{-1}}"),
  // Mass
  kg: unit("mass", "kg", 1),
  /** Solar mass: the measured GM☉ divided by G (CODATA 2022), 1.98841 × 10³⁰ kg. */
  Msun: unit("mass", "M☉", SOLAR_GM_SI / GRAVITATIONAL_CONSTANT_SI, "M_\\odot"),
  /** Earth mass: the nominal GM⊕ divided by G, 5.9722 × 10²⁴ kg. */
  Mearth: unit("mass", "M⊕", EARTH_GM_SI / GRAVITATIONAL_CONSTANT_SI, "M_\\oplus"),
  // Speed
  "m/s": unit("speed", "m/s", 1, "\\mathrm{m\\,s^{-1}}"),
  "km/s": unit("speed", "km/s", 1e3, "\\mathrm{km\\,s^{-1}}"),
  "au/yr": unit("speed", "au/yr", AU / YEAR, "\\mathrm{au\\,yr^{-1}}"),
  c: unit("speed", "c", C, "c"),
  // Acceleration
  "m/s2": unit("acceleration", "m/s²", 1, "\\mathrm{m\\,s^{-2}}"),
  // Rate (per second)
  Hz: unit("rate", "s⁻¹", 1, "\\mathrm{s^{-1}}"),
  /** The Hubble constant's unit: km/s of recession per Mpc of distance. */
  "km/s/Mpc": unit("rate", "km/s/Mpc", 1e3 / (1e6 * PC), "\\mathrm{km\\,s^{-1}\\,Mpc^{-1}}"),
  // Temperature
  K: unit("temperature", "K", 1),
  // Energy
  J: unit("energy", "J", 1),
  /** Electronvolt: the energy one elementary charge gains across one volt (exact). */
  eV: unit("energy", "eV", ELEMENTARY_CHARGE_SI),
  // Power
  W: unit("power", "W", 1),
  /** Nominal solar luminosity (IAU 2015 Resolution B3). */
  Lsun: unit("power", "L☉", SOLAR_LUMINOSITY_SI, "L_\\odot"),
} as const satisfies Record<string, UnitDefinition>;

export type UnitId = keyof typeof UNITS;
export type UnitOf<D extends Dimension> = {
  [K in UnitId]: (typeof UNITS)[K]["dimension"] extends D ? K : never;
}[UnitId];

/** Converts between two units of the same dimension. */
export function convert(value: number, from: UnitId, to: UnitId) {
  if (!Number.isFinite(value)) throw new RangeError("Value must be finite");
  const a = UNITS[from];
  const b = UNITS[to];
  if (a.dimension !== b.dimension)
    throw new TypeError(`Cannot convert ${a.dimension} (${from}) to ${b.dimension} (${to})`);
  return (value * a.factor) / b.factor;
}
