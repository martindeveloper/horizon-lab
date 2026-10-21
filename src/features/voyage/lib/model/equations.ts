/**
 * Voyage's formulas as `technical.json` prints them by ID: each computes through the model's
 * own function (`irradianceAt`, the toolkit's `torchTrip`), so there is one of each.
 */
import {
  AU_KM,
  STANDARD_GRAVITY,
  defineEquation,
  formatNumber,
  keplerThirdLaw,
  lightTravelTime,
  lorentzFactor,
  rapidity,
  relativisticDopplerLaw,
  timeDilation,
  torchTrip as torchTripClocks,
  type Formula,
} from "@horizon/toolkit/science";

import { SOLAR_CONSTANT_W_M2, STANDARD_GRAVITY_KM_S2, irradianceAt } from "./parameters";

const n = (value: number) => formatNumber(value, "en", 4);

/** Sunlight falls off as the inverse square of the distance from the Sun. */
export const irradiance = defineEquation({
  id: "solar-irradiance",
  text: `S = ${n(SOLAR_CONSTANT_W_M2)} W/m² · (1 au / r)²`,
  latex: `S = ${n(SOLAR_CONSTANT_W_M2)}\\,\\mathrm{W/m^2}\\left(\\frac{1\\,\\mathrm{au}}{r}\\right)^2`,
  output: "S",
  variables: {
    r: { symbol: "r", latex: "r", unit: "au" },
    S: { symbol: "S", latex: "S" },
  },
  compute: ({ r }) => irradianceAt(r * AU_KM),
  source: "Kopp & Lean (2011)",
});

/**
 * A torch ship at one g, turning over halfway: its own time for a trip of D. The number in
 * the formula is c/a in years: a year and a little, the time a one-g ship takes to reach c in
 * Newtonian terms.
 */
export const torchTrip = defineEquation({
  id: "torch-trip",
  text: `τ = 2 (c / a) acosh(1 + a D / 2c²),  a = ${n(STANDARD_GRAVITY_KM_S2 * 1000)} m/s²`,
  latex: `\\tau = \\frac{2c}{a}\\,\\operatorname{acosh}\\!\\left(1 + \\frac{aD}{2c^2}\\right), \\quad a = ${n(STANDARD_GRAVITY_KM_S2 * 1000)}\\,\\mathrm{m/s^2}`,
  output: "tau",
  variables: {
    D: { symbol: "D", latex: "D", unit: "km" },
    tau: { symbol: "τ", latex: "\\tau", unit: "s" },
  },
  compute: ({ D }) => torchTripClocks(D, STANDARD_GRAVITY).tau,
});

/** Every formula Voyage's `technical.json` may reference by ID. */
export const VOYAGE_EQUATIONS = Object.fromEntries<Formula>(
  [
    keplerThirdLaw,
    lightTravelTime,
    irradiance,
    lorentzFactor,
    timeDilation,
    relativisticDopplerLaw,
    rapidity,
    torchTrip,
  ].map((equation) => [equation.id, equation]),
);
