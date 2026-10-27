import {
  ATOMIC_MASS_CONSTANT_SI,
  BOLTZMANN_CONSTANT_SI,
  CLASSICAL_ELECTRON_RADIUS_SI,
  CMB_TEMPERATURE_SI,
  ELECTRON_MASS_SI,
  ELEMENTARY_CHARGE_SI,
  GRAVITATIONAL_CONSTANT_SI,
  PLANCK_CONSTANT_SI,
  PROTON_MASS_SI,
  RYDBERG_CONSTANT_SI,
  SOLAR_GM_SI,
  SPEED_OF_LIGHT_SI,
  VACUUM_PERMEABILITY_SI,
} from "./definitions";
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
  solarEffectiveTemperature: {
    symbol: "T☉",
    latex: "T_\\odot",
    value: 5772,
    unit: "K",
    unitLatex: "\\mathrm{K}",
    exact: true,
    source: "IAU 2015 Resolution B3 nominal value",
  },
  solarIrradiance: {
    symbol: "S☉",
    latex: "S_\\odot",
    value: 1361,
    unit: "W m⁻²",
    unitLatex: "\\mathrm{W\\,m^{-2}}",
    exact: true,
    source: "IAU 2015 Resolution B3 nominal value",
  },
  jupiterGravitationalParameter: {
    symbol: "GM♃",
    latex: "GM_\\mathrm{J}",
    value: 1.266_865_3e17,
    unit: "m³ s⁻²",
    unitLatex: "\\mathrm{m^3\\,s^{-2}}",
    exact: true,
    source: "IAU 2015 Resolution B3 nominal value",
  },
  planckConstant: {
    symbol: "h",
    latex: "h",
    value: PLANCK_CONSTANT_SI,
    unit: "J s",
    unitLatex: "\\mathrm{J\\,s}",
    exact: true,
    source: "SI definition of the kilogram (2019)",
  },
  boltzmannConstant: {
    symbol: "k",
    latex: "k",
    value: BOLTZMANN_CONSTANT_SI,
    unit: "J K⁻¹",
    unitLatex: "\\mathrm{J\\,K^{-1}}",
    exact: true,
    source: "SI definition of the kelvin (2019)",
  },
  elementaryCharge: {
    symbol: "e",
    latex: "e",
    value: ELEMENTARY_CHARGE_SI,
    unit: "C",
    unitLatex: "\\mathrm{C}",
    exact: true,
    source: "SI definition of the ampere (2019)",
  },
  electronMass: {
    symbol: "mₑ",
    latex: "m_e",
    value: ELECTRON_MASS_SI,
    unit: "kg",
    unitLatex: "\\mathrm{kg}",
    exact: false,
    source: "CODATA 2022",
  },
  protonMass: {
    symbol: "mₚ",
    latex: "m_p",
    value: PROTON_MASS_SI,
    unit: "kg",
    unitLatex: "\\mathrm{kg}",
    exact: false,
    source: "CODATA 2022",
  },
  atomicMassConstant: {
    symbol: "mᵤ",
    latex: "m_u",
    value: ATOMIC_MASS_CONSTANT_SI,
    unit: "kg",
    unitLatex: "\\mathrm{kg}",
    exact: false,
    source: "CODATA 2022",
  },
  hydrogen1AtomicMass: {
    symbol: "m(¹H)",
    latex: "m({}^1\\mathrm{H})",
    value: 1.00782503223 * ATOMIC_MASS_CONSTANT_SI,
    unit: "kg",
    unitLatex: "\\mathrm{kg}",
    exact: false,
    source: "NIST Atomic Weights and Isotopic Compositions, ¹H relative atomic mass (neutral atom)",
  },
  helium4AtomicMass: {
    symbol: "m(⁴He)",
    latex: "m({}^4\\mathrm{He})",
    value: 4.00260325413 * ATOMIC_MASS_CONSTANT_SI,
    unit: "kg",
    unitLatex: "\\mathrm{kg}",
    exact: false,
    source:
      "NIST Atomic Weights and Isotopic Compositions, ⁴He relative atomic mass (neutral atom)",
  },
  classicalElectronRadius: {
    symbol: "rₑ",
    latex: "r_e",
    value: CLASSICAL_ELECTRON_RADIUS_SI,
    unit: "m",
    unitLatex: "\\mathrm{m}",
    exact: false,
    source: "CODATA 2022",
  },
  rydbergConstant: {
    symbol: "R∞",
    latex: "R_\\infty",
    value: RYDBERG_CONSTANT_SI,
    unit: "m⁻¹",
    unitLatex: "\\mathrm{m^{-1}}",
    exact: false,
    source: "CODATA 2022",
  },
  vacuumPermeability: {
    symbol: "μ₀",
    latex: "\\mu_0",
    value: VACUUM_PERMEABILITY_SI,
    unit: "N A⁻²",
    unitLatex: "\\mathrm{N\\,A^{-2}}",
    exact: false,
    source: "CODATA 2022",
  },
  cmbTemperature: {
    symbol: "T₀",
    latex: "T_0",
    value: CMB_TEMPERATURE_SI,
    unit: "K",
    unitLatex: "\\mathrm{K}",
    exact: false,
    source: "Fixsen 2009, ApJ 707, 916",
  },
} as const satisfies Record<string, Constant>;

export type ConstantId = keyof typeof CONSTANTS;

/** Named values for code, in the units their names state. */
export const GRAVITATIONAL_CONSTANT = CONSTANTS.gravitationalConstant.value; // m³ kg⁻¹ s⁻²
export const SPEED_OF_LIGHT = CONSTANTS.speedOfLight.value; // m s⁻¹
/** The speed of light in km/s, the unit a ship's velocity is kept in. */
export const SPEED_OF_LIGHT_KM_S = SPEED_OF_LIGHT / 1e3;
/** Standard acceleration of gravity, m s⁻² (CGPM 1901, exact). */
export const STANDARD_GRAVITY = 9.80665;
export const SOLAR_MASS_KG = CONSTANTS.solarMass.value;
export const SOLAR_RADIUS_KM = CONSTANTS.solarRadius.value / 1e3;
export const SOLAR_TEFF_K = CONSTANTS.solarEffectiveTemperature.value;
/** The Sun's absolute visual magnitude M_V (Allen's Astrophysical Quantities, 4th ed., 2000). */
export const SOLAR_ABSOLUTE_MAGNITUDE_V = 4.83;
/** Sunlight's power per square metre at 1 au, W m⁻² (the total solar irradiance). */
export const SOLAR_IRRADIANCE_W_M2 = CONSTANTS.solarIrradiance.value;
export const JUPITER_GM_SI = CONSTANTS.jupiterGravitationalParameter.value; // m³ s⁻²
export const AU_KM = CONSTANTS.astronomicalUnit.value / 1e3;
export const LIGHT_YEAR_KM = CONSTANTS.lightYear.value / 1e3;
export const JULIAN_YEAR_SECONDS = CONSTANTS.julianYear.value;
export const PLANCK_CONSTANT = CONSTANTS.planckConstant.value; // J s
export const BOLTZMANN_CONSTANT = CONSTANTS.boltzmannConstant.value; // J K⁻¹
/** Joules in one electronvolt (the elementary charge's value). */
export const ELECTRON_VOLT_J = CONSTANTS.elementaryCharge.value;
export const ELECTRON_MASS_KG = CONSTANTS.electronMass.value;
export const PROTON_MASS_KG = CONSTANTS.protonMass.value;
export const ATOMIC_MASS_KG = CONSTANTS.atomicMassConstant.value;
export const CLASSICAL_ELECTRON_RADIUS_M = CONSTANTS.classicalElectronRadius.value;
export const RYDBERG_INFINITY = CONSTANTS.rydbergConstant.value; // m⁻¹
/** The cosmic microwave background's temperature today, K. */
export const CMB_TEMPERATURE_K = CONSTANTS.cmbTemperature.value;
export const VACUUM_PERMEABILITY = CONSTANTS.vacuumPermeability.value; // N A⁻²
/** Radians in one degree (π/180): multiply degrees by it, divide radians by it. */
export const RAD_PER_DEG = UNITS.deg.factor;
/** Seconds in a day and in an hour (the SI day of 86,400 s). */
export const DAY_SECONDS = UNITS.d.factor;
export const HOUR_SECONDS = UNITS.h.factor;
/** The kelvin temperature of 0 °C (exact, SI). */
export const CELSIUS_ZERO_K = 273.15;
/** Liquid water's density, kg m⁻³: the 1 g cm⁻³ a body's density is compared with. */
export const WATER_DENSITY_KG_M3 = 1_000;
