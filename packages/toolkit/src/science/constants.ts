import { GRAVITATIONAL_CONSTANT_SI, SOLAR_GM_SI, SPEED_OF_LIGHT_SI } from "./definitions";
import { UNITS } from "./units";

/**
 * Every constant once, with its symbol, value in SI, and where the value comes
 * from, so tests can check it and a page can print it. Keep precision changes
 * deliberate: they move every simulation that reads them.
 */
export type Constant = {
  /** Display symbol. */
  symbol: string;
  latex: string;
  /** Value in SI units. */
  value: number;
  /** SI unit as displayed, e.g. "m s⁻¹". */
  unit: string;
  unitLatex: string;
  /** Fixed by definition rather than measured. */
  exact: boolean;
  source: string;
};

export const CONSTANTS = {
  speedOfLight: {
    symbol: "c",
    latex: "c",
    value: SPEED_OF_LIGHT_SI,
    unit: "m s⁻¹",
    unitLatex: "\\mathrm{m\\,s^{-1}}",
    exact: true,
    source: "SI definition of the metre (1983, kept in 2019)",
  },
  gravitationalConstant: {
    symbol: "G",
    latex: "G",
    value: GRAVITATIONAL_CONSTANT_SI,
    unit: "m³ kg⁻¹ s⁻²",
    unitLatex: "\\mathrm{m^3\\,kg^{-1}\\,s^{-2}}",
    exact: false,
    source: "CODATA 2022",
  },
  astronomicalUnit: {
    symbol: "au",
    latex: "\\mathrm{au}",
    value: UNITS.au.factor,
    unit: "m",
    unitLatex: "\\mathrm{m}",
    exact: true,
    source: "IAU 2012 Resolution B2",
  },
  parsec: {
    symbol: "pc",
    latex: "\\mathrm{pc}",
    value: UNITS.pc.factor,
    unit: "m",
    unitLatex: "\\mathrm{m}",
    exact: true,
    source: "IAU 2015 Resolution B2: 648 000/π au",
  },
  lightYear: {
    symbol: "ly",
    latex: "\\mathrm{ly}",
    value: UNITS.ly.factor,
    unit: "m",
    unitLatex: "\\mathrm{m}",
    exact: true,
    source: "IAU: c × one Julian year",
  },
  julianYear: {
    symbol: "yr",
    latex: "\\mathrm{yr}",
    value: UNITS.yr.factor,
    unit: "s",
    unitLatex: "\\mathrm{s}",
    exact: true,
    source: "IAU: 365.25 days of 86 400 s",
  },
  solarGravitationalParameter: {
    symbol: "GM☉",
    latex: "GM_\\odot",
    value: SOLAR_GM_SI,
    unit: "m³ s⁻²",
    unitLatex: "\\mathrm{m^3\\,s^{-2}}",
    exact: true,
    source: "IAU 2015 Resolution B3 nominal value",
  },
  solarMass: {
    symbol: "M☉",
    latex: "M_\\odot",
    value: UNITS.Msun.factor,
    unit: "kg",
    unitLatex: "\\mathrm{kg}",
    exact: false,
    source: "GM☉ (IAU 2015 B3) / G (CODATA 2022)",
  },
  solarRadius: {
    symbol: "R☉",
    latex: "R_\\odot",
    value: UNITS.Rsun.factor,
    unit: "m",
    unitLatex: "\\mathrm{m}",
    exact: true,
    source: "IAU 2015 Resolution B3 nominal value",
  },
} as const satisfies Record<string, Constant>;

export type ConstantId = keyof typeof CONSTANTS;

/** Named values for code, in the units their names state. */
export const GRAVITATIONAL_CONSTANT = CONSTANTS.gravitationalConstant.value; // m³ kg⁻¹ s⁻²
export const SPEED_OF_LIGHT = CONSTANTS.speedOfLight.value; // m s⁻¹
export const SOLAR_MASS_KG = CONSTANTS.solarMass.value;
export const SOLAR_RADIUS_KM = CONSTANTS.solarRadius.value / 1e3;
export const AU_KM = CONSTANTS.astronomicalUnit.value / 1e3;
export const LIGHT_YEAR_KM = CONSTANTS.lightYear.value / 1e3;
export const JULIAN_YEAR_SECONDS = CONSTANTS.julianYear.value;
