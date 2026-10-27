/**
 * The Sun lab's formulas, written once: each `compute` calls the function the model computes
 * with, so the printed equation and the scene cannot drift. The general laws (the scale height,
 * mean density) are the science kit's.
 */
import {
  RAD_PER_DEG,
  defineEquation,
  meanDensity,
  pressureScaleHeight,
  type Formula,
} from "@horizon/toolkit/science";

import { goesFlux } from "./model/activity";
import { whiteLightCorona } from "./model/corona";
import { wolfNumber } from "./model/cycle";
import { loopTemperature } from "./model/field";
import { fusionEnergy, massToEnergyRate, PP_MASS_FRACTION } from "./model/fusion";
import { BAUMBACH_TERMS, GOES_CLASSES, LOOP_REFERENCE } from "./model/parameters";
import { alfvenSpeed, magneticEnergy } from "./model/plasma";
import { SURFACE_ROTATION_DEG_PER_DAY, surfaceRateDegPerDay } from "./model/rotation";
import { diffusionTime, hydrostaticGradient } from "./model/structure";

const { A, B, C } = SURFACE_ROTATION_DEG_PER_DAY;
const signed = (v: number) => `${v < 0 ? "−" : "+"} ${Math.abs(v)}`;

/** Snodgrass & Ulrich 1990: the surface turns slower at higher latitude. */
export const differentialRotation = defineEquation({
  id: "differential-rotation",
  text: `Ω(φ) = ${A} ${signed(B)} sin²φ ${signed(C)} sin⁴φ  °/day`,
  latex: `\\Omega(\\varphi) = ${A} ${signed(B).replace("−", "-")} \\sin^2\\varphi ${signed(C).replace("−", "-")} \\sin^4\\varphi\\ ^\\circ/\\mathrm{day}`,
  output: "Omega",
  variables: {
    phi: { symbol: "φ", latex: "\\varphi", unit: "deg" },
    Omega: { symbol: "Ω (°/day)", latex: "\\Omega\\;(^\\circ/\\mathrm{day})" },
  },
  compute: ({ phi }) => surfaceRateDegPerDay(phi * RAD_PER_DEG),
  source: "Snodgrass & Ulrich 1990",
});

/** Every layer holds up the weight of those above it. */
export const hydrostaticEquilibrium = defineEquation({
  id: "hydrostatic-equilibrium",
  text: "dP/dr = −ρ g",
  latex: "\\frac{dP}{dr} = -\\rho\\, g",
  output: "dPdr",
  variables: {
    rho: { symbol: "ρ (kg/m³)", latex: "\\rho\\;(\\mathrm{kg/m^3})" },
    g: { symbol: "g", latex: "g", unit: "m/s2" },
    dPdr: { symbol: "dP/dr (Pa/m)", latex: "dP/dr\\;(\\mathrm{Pa/m})" },
  },
  compute: ({ rho, g }) => hydrostaticGradient(rho, g),
});

/** Net atomic bookkeeping, including positron annihilation; Q includes escaping neutrinos. */
export const ppChainEnergy = defineEquation({
  id: "pp-chain-energy",
  text: `4 ¹H → ⁴He + 2ν_e,  E = Δm c²,  Δm = ${(100 * PP_MASS_FRACTION).toFixed(2)} % of m_fuel`,
  latex: `4\\,{}^1\\mathrm{H} \\to {}^4\\mathrm{He} + 2\\nu_e,\\quad E = \\Delta m\\, c^2,\\quad \\Delta m = ${(100 * PP_MASS_FRACTION).toFixed(2)}\\,\\%\\ \\text{of}\\ m_{\\mathrm{fuel}}`,
  output: "E",
  variables: {
    m: { symbol: "m_fuel", latex: "m_{\\mathrm{fuel}}", unit: "kg" },
    E: { symbol: "E", latex: "E", unit: "J" },
  },
  compute: ({ m }) => fusionEnergy(m),
  source: "Bethe 1939; Borexino 2018",
});

/** What the Sun's light weighs: the mass that leaves it each second. */
export const massLossRate = defineEquation({
  id: "mass-loss-rate",
  text: "Ṁ = L / c²",
  latex: "\\dot M = \\frac{L}{c^2}",
  output: "Mdot",
  variables: {
    L: { symbol: "L", latex: "L", unit: "W" },
    Mdot: { symbol: "Ṁ (kg/s)", latex: "\\dot M\\;(\\mathrm{kg/s})" },
  },
  compute: ({ L }) => massToEnergyRate(L),
});

/** A photon's random walk out through the opacity: ℓ is the integral over the model. */
export const photonDiffusionTime = defineEquation({
  id: "photon-diffusion-time",
  text: "t ≈ (6 / c) ∫₀ᴿᶜᶻ κ ρ r dr",
  latex: "t \\approx \\frac{6}{c} \\int_0^{R_{\\mathrm{cz}}} \\kappa \\rho\\, r\\, dr",
  output: "t",
  variables: {
    ell: { symbol: "∫ κ ρ r dr", latex: "\\int \\kappa \\rho\\, r\\, dr", unit: "m" },
    t: { symbol: "t", latex: "t", unit: "s" },
  },
  compute: ({ ell }) => diffusionTime(ell),
  source: "Mitalas & Sills 1992, eq. 9 (continuum shell estimate to convection-zone base)",
});

/** Wolf's relative number: a group counts ten, a spot one. */
export const wolfNumberLaw = defineEquation({
  id: "wolf-number",
  text: "R = k (10 g + s)",
  latex: "R = k\\,(10\\,g + s)",
  output: "R",
  variables: {
    k: { symbol: "k", latex: "k" },
    g: { symbol: "g", latex: "g" },
    s: { symbol: "s", latex: "s" },
    R: { symbol: "R", latex: "R" },
  },
  compute: ({ k, g, s }) => wolfNumber(g, s, k),
  source: "Wolf 1852",
});

/** How fast a disturbance runs along the field. */
export const alfvenSpeedLaw = defineEquation({
  id: "alfven-speed",
  text: "v_A = B / √(μ₀ ρ)",
  latex: "v_A = \\frac{B}{\\sqrt{\\mu_0 \\rho}}",
  output: "vA",
  variables: {
    B: { symbol: "B", latex: "B", unit: "T" },
    rho: { symbol: "ρ (kg/m³)", latex: "\\rho\\;(\\mathrm{kg/m^3})" },
    vA: { symbol: "v_A", latex: "v_A", unit: "m/s" },
  },
  compute: ({ B, rho }) => alfvenSpeed(B, rho),
  source: "Alfvén 1942",
});

/** Total energy of a uniform field. Only free energy above a reference field can be released. */
export const reconnectionEnergy = defineEquation({
  id: "reconnection-energy",
  text: "E_B = (B² / 2μ₀) V",
  latex: "E_B = \\frac{B^2}{2\\mu_0}\\, V",
  output: "E",
  variables: {
    B: { symbol: "B", latex: "B", unit: "T" },
    V: { symbol: "V (m³)", latex: "V\\;(\\mathrm{m^3})" },
    E: { symbol: "E_B", latex: "E_B", unit: "J" },
  },
  compute: ({ B, V }) => magneticEnergy(B, V),
});

/** A loop's temperature: the RTV scaling with braiding heating, anchored to a 1 MK fan loop. */
export const loopTemperatureLaw = defineEquation({
  id: "loop-temperature",
  text: "T = T₀ (B² L / B₀² L₀)^(2/7)",
  latex: "T = T_0 \\left(\\frac{B^2 L}{B_0^2 L_0}\\right)^{2/7}",
  output: "T",
  variables: {
    B: { symbol: "B", latex: "B", unit: "T" },
    L: { symbol: "L", latex: "L", unit: "Rsun" },
    T: { symbol: "T", latex: "T", unit: "K" },
  },
  compute: ({ B, L }) => loopTemperature(B, L),
  source: `Rosner, Tucker & Vaiana 1978; Reale 2014 (T₀ = ${LOOP_REFERENCE.kelvin / 1e6} MK at ${LOOP_REFERENCE.fieldT * 1e4} G and ${LOOP_REFERENCE.lengthR} R☉)`,
});

/** GOES classes: each letter a decade of 1–8 Å flux, the number its multiplier. */
export const goesClass = defineEquation({
  id: "goes-class",
  text: `F = n × 10^(k−8) W/m²,  k = 0…4 for ${GOES_CLASSES.join(", ")}`,
  latex: `F = n \\times 10^{k-8}\\ \\mathrm{W/m^2},\\quad k = 0 \\ldots 4\\ \\text{for}\\ ${GOES_CLASSES.join(", ")}`,
  output: "F",
  variables: {
    k: { symbol: "k", latex: "k" },
    n: { symbol: "n", latex: "n" },
    F: { symbol: "F (W/m²)", latex: "F\\;(\\mathrm{W/m^2})" },
  },
  compute: ({ k, n }) => goesFlux(k, n),
});

/**
 * Baumbach 1937: the white-light corona's brightness falls as three powers of the radius, the
 * flat term the dust's (F), the steep two the electrons' (K).
 */
export const baumbachCorona = defineEquation({
  id: "baumbach-corona",
  text: `B(ρ) ∝ ${BAUMBACH_TERMS.map(({ coefficient, power }) => `${coefficient} ρ^−${power}`).join(" + ")}`,
  latex: `B(\\rho) \\propto ${BAUMBACH_TERMS.map(({ coefficient, power }) => `${coefficient}\\,\\rho^{-${power}}`).join(" + ")}`,
  output: "B",
  variables: {
    rho: { symbol: "ρ", latex: "\\rho" },
    B: { symbol: "B", latex: "B" },
  },
  compute: ({ rho }) => whiteLightCorona(rho),
  source: "Baumbach 1937, Astron. Nachr. 263, 121",
});

/** Every formula the technical details and the guide may name, by ID. */
export const SUN_EQUATIONS: Record<string, Formula> = Object.fromEntries(
  [
    differentialRotation,
    hydrostaticEquilibrium,
    ppChainEnergy,
    massLossRate,
    photonDiffusionTime,
    pressureScaleHeight,
    meanDensity,
    wolfNumberLaw,
    alfvenSpeedLaw,
    reconnectionEnergy,
    loopTemperatureLaw,
    goesClass,
    baumbachCorona,
  ].map((equation) => [equation.id, equation]),
);
