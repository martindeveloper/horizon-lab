/**
 * Afterglow's formulas: the shared laws it computes with, and its own derived from them. Every
 * figure the scene, the cards and the captions show comes through one of these.
 */
import { YOUNG_SUN_EQUATIONS } from "@/space/sun/model/young-sun";
import {
  AU_KM,
  SOLAR_RADIUS_KM,
  defineEquation,
  keplerThirdLaw,
  planckLaw,
  stefanBoltzmann,
  stellarRadius,
  surfaceGravity,
  wienDisplacement,
  type Formula,
} from "@horizon/toolkit/science";

/** An orbit widens as its star loses mass, its angular momentum kept: a ∝ 1 / M. */
export const orbitWidening = defineEquation({
  id: "orbit-widening",
  text: "a = a₀ (M₀ / M)",
  latex: "a = a_0 \\frac{M_0}{M}",
  output: "a",
  variables: {
    a0: { symbol: "a₀", latex: "a_0", unit: "au" },
    M: { symbol: "M", latex: "M", unit: "Msun" },
    a: { symbol: "a", latex: "a", unit: "au" },
  },
  compute: ({ a0, M }) => a0 / M,
  source: "Jeans (1924): adiabatic mass loss",
});

/** Kepler's third law about a star of any mass: years, au and solar masses. */
export const orbitalPeriod = defineEquation({
  id: "orbital-period",
  text: "P² = a³ / M",
  latex: "P^2 = \\frac{a^3}{M}",
  output: "P",
  variables: {
    a: { symbol: "a", latex: "a", unit: "au" },
    M: { symbol: "M", latex: "M", unit: "Msun" },
    P: { symbol: "P", latex: "P", unit: "yr" },
  },
  compute: ({ a, M }) => keplerThirdLaw.compute({ a }) / Math.sqrt(M),
  source: "Kepler, Harmonices Mundi (1619); Newton's form",
});

/** Sunlight at a world as a share of Earth's today: the inverse square of the distance, times the Sun's light. */
export const sunlightShare = defineEquation({
  id: "sunlight-share",
  text: "S / S⊕ = (L / L☉) (au / d)²",
  latex: "\\frac{S}{S_\\oplus} = \\frac{L}{L_\\odot}\\left(\\frac{\\mathrm{au}}{d}\\right)^2",
  output: "S",
  variables: {
    L: { symbol: "L / L☉", latex: "L/L_\\odot" },
    d: { symbol: "d", latex: "d", unit: "au" },
    S: { symbol: "S / S⊕", latex: "S/S_\\oplus" },
  },
  compute: ({ L, d }) => L / d ** 2,
});

/**
 * A world's equilibrium temperature: the warmth sunlight alone holds it at, spread over a
 * spinning sphere that absorbs all but its Bond albedo and radiates as a black body, written
 * with the star's own surface temperature and radius, so no constant beyond them enters.
 */
export const equilibriumTemperature = defineEquation({
  id: "equilibrium-temperature",
  text: "T_eq = T★ (1 − A)^¼ √(R★ / 2d)",
  latex: "T_{eq} = T_\\star (1 - A)^{1/4} \\sqrt{\\frac{R_\\star}{2d}}",
  output: "Teq",
  variables: {
    T: { symbol: "T★", latex: "T_\\star", unit: "K" },
    A: { symbol: "A", latex: "A" },
    R: { symbol: "R★", latex: "R_\\star", unit: "au" },
    d: { symbol: "d", latex: "d", unit: "au" },
    Teq: { symbol: "T_eq", latex: "T_{eq}", unit: "K" },
  },
  compute: ({ T, A, R, d }) => T * (1 - A) ** 0.25 * Math.sqrt(R / (2 * d)),
});

/** The Sun's angular diameter from a world: 2 asin(R / d). */
export const angularSize = defineEquation({
  id: "angular-size",
  text: "θ = 2 asin(R / d)",
  latex: "\\theta = 2\\,\\operatorname{asin}\\!\\left(\\frac{R}{d}\\right)",
  output: "theta",
  variables: {
    R: { symbol: "R", latex: "R", unit: "au" },
    d: { symbol: "d", latex: "d", unit: "au" },
    theta: { symbol: "θ", latex: "\\theta", unit: "rad" },
  },
  compute: ({ R, d }) => 2 * Math.asin(Math.min(1, R / d)),
});

/** Solar radii per astronomical unit. */
export const RSUN_PER_AU = AU_KM / SOLAR_RADIUS_KM;

/** Every formula Afterglow's captions and `technical.ts` may reference by ID. */
export const AFTERGLOW_EQUATIONS = Object.fromEntries<Formula>(
  [
    stefanBoltzmann,
    stellarRadius,
    planckLaw,
    wienDisplacement,
    ...YOUNG_SUN_EQUATIONS,
    orbitWidening,
    keplerThirdLaw,
    orbitalPeriod,
    sunlightShare,
    angularSize,
    equilibriumTemperature,
    surfaceGravity,
  ].map((equation) => [equation.id, equation]),
);
