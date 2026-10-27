import { baumbachCorona } from "@/space/sun/equations";
import {
  defineEquation,
  meanDensity,
  pressureScaleHeight,
  photonSphereRadius,
  schwarzschildRadius,
  shadowRadius,
  stefanBoltzmann,
  type Formula,
} from "@horizon/toolkit/science";

import { GRANULE_SCALE_HEIGHTS } from "../parameters";
import { granulesAcross, lightLapSeconds, spheroidDensity } from "./physics";

/**
 * Giants' formulas, written once: the cards' derived figures compute with them, and the guide
 * and the technical details print them. Each `compute` calls the function the lab uses
 * (`physics.ts`), so the two cannot drift; the general laws (Stefan–Boltzmann, the scale
 * height, mean density, the horizon, its photon sphere and shadow) are the science kit's.
 */

/** Convection cells across a radius, each a few scale heights wide. */
const granuleCount = defineEquation({
  id: "granules-across",
  text: `N ≈ R / (${GRANULE_SCALE_HEIGHTS} H)`,
  latex: `N \\approx \\frac{R}{${GRANULE_SCALE_HEIGHTS} H}`,
  output: "N",
  variables: {
    M: { symbol: "M / M☉", latex: "M/M_\\odot" },
    R: { symbol: "R / R☉", latex: "R/R_\\odot" },
    T: { symbol: "T", latex: "T", unit: "K" },
    N: { symbol: "N", latex: "N" },
  },
  compute: ({ M, R, T }) => granulesAcross(M, R, T),
});

/** Equatorial circumference / c, a geometric size comparison. */
export const lightLap = defineEquation({
  id: "light-lap",
  text: "t = 2πR / c",
  latex: "t = \\frac{2 \\pi R}{c}",
  output: "t",
  variables: {
    R: { symbol: "R", latex: "R", unit: "m" },
    t: { symbol: "t", latex: "t", unit: "s" },
  },
  compute: ({ R }) => lightLapSeconds(R),
});

/** Mean density for the same oblate spheroid the ladder draws. */
export const oblateDensity = defineEquation({
  id: "spheroid-density",
  text: "ρ = 3M / (4πa²b)",
  latex: "\\rho = \\frac{3M}{4\\pi a^2 b}",
  output: "rho",
  variables: {
    M: { symbol: "M", latex: "M", unit: "kg" },
    a: { symbol: "a", latex: "a", unit: "m" },
    b: { symbol: "b", latex: "b", unit: "m" },
    rho: { symbol: "ρ (kg/m³)", latex: "\\rho\\;(\\mathrm{kg/m^3})" },
  },
  compute: ({ M, a, b }) => spheroidDensity(M, a, b),
});

/** Every formula the technical details and the guide may name, by ID. */
export const GIANTS_EQUATIONS: Record<string, Formula> = Object.fromEntries(
  [
    stefanBoltzmann,
    pressureScaleHeight,
    granuleCount,
    lightLap,
    meanDensity,
    oblateDensity,
    schwarzschildRadius,
    photonSphereRadius,
    shadowRadius,
    baumbachCorona,
  ].map((equation) => [equation.id, equation]),
);
