/**
 * Voyage's formulas as `technical.ts` prints them by ID: each computes through the model's
 * own function (`irradianceAt`, the toolkit's `torchTrip`), so there is one of each.
 */
import {
  AU_KM,
  SOLAR_IRRADIANCE_W_M2,
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

import { irradianceAt } from "./parameters";

const n = (value: number) => formatNumber(value, "en", 4);

/** Sunlight falls off as the inverse square of the distance from the Sun. */
export const irradiance = defineEquation({
  id: "solar-irradiance",
  text: `S = ${n(SOLAR_IRRADIANCE_W_M2)} W/m² · (1 au / r)²`,
  latex: `S = ${n(SOLAR_IRRADIANCE_W_M2)}\\,\\mathrm{W/m^2}\\left(\\frac{1\\,\\mathrm{au}}{r}\\right)^2`,
  output: "S",
  variables: {
    r: { symbol: "r", latex: "r", unit: "au" },
    S: { symbol: "S", latex: "S" },
  },
  compute: ({ r }) => irradianceAt(r * AU_KM),
  source: "Kopp & Lean (2011)",
});

/**
 * A torch ship at one g, turning over halfway: its own time for a trip of D. The formula
 * prints the acceleration it holds, standard gravity in m/s²; c/a, the time scale in front, is
 * a little under a year at one g.
 */
export const torchTrip = defineEquation({
  id: "torch-trip",
  text: `τ = 2 (c / a) acosh(1 + a D / 2c²),  a = ${n(STANDARD_GRAVITY)} m/s²`,
  latex: `\\tau = \\frac{2c}{a}\\,\\operatorname{acosh}\\!\\left(1 + \\frac{aD}{2c^2}\\right), \\quad a = ${n(STANDARD_GRAVITY)}\\,\\mathrm{m/s^2}`,
  output: "tau",
  variables: {
    D: { symbol: "D", latex: "D", unit: "km" },
    tau: { symbol: "τ", latex: "\\tau", unit: "s" },
  },
  compute: ({ D }) => torchTripClocks(D, STANDARD_GRAVITY).tau,
});

/** Every formula Voyage's `technical.ts` may reference by ID. */
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
