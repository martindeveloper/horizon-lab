import { CONSTANTS } from "./constants";
import { defineEquation } from "./equation";
import { UNITS } from "./units";

/**
 * Laws shared by every simulation. A simulation's own formulas (Kerr radii,
 * migration sketches) live in the feature, built with `defineEquation` too.
 */

export const pythagoras = defineEquation({
  id: "pythagoras",
  text: "c = √(a² + b²)",
  latex: "c = \\sqrt{a^2 + b^2}",
  output: "c",
  variables: {
    a: { symbol: "a", latex: "a" },
    b: { symbol: "b", latex: "b" },
    c: { symbol: "c", latex: "c" },
  },
  compute: ({ a, b }) => Math.hypot(a, b),
});

/** For a body circling the Sun with negligible mass: years and astronomical units. */
export const keplerThirdLaw = defineEquation({
  id: "kepler-third-law",
  text: "P² = a³",
  latex: "P^2 = a^3",
  output: "P",
  variables: {
    a: { symbol: "a", latex: "a", unit: "au" },
    P: { symbol: "P", latex: "P", unit: "yr" },
  },
  compute: ({ a }) => a ** 1.5,
  source: "Kepler, Harmonices Mundi (1619)",
});

/** How long light takes to cross a distance. */
export const lightTravelTime = defineEquation({
  id: "light-travel-time",
  text: "t = d / c",
  latex: "t = \\frac{d}{c}",
  output: "t",
  variables: {
    d: { symbol: "d", latex: "d", unit: "m" },
    t: { symbol: "t", latex: "t", unit: "s" },
  },
  compute: ({ d }) => d / CONSTANTS.speedOfLight.value,
});

export const schwarzschildRadius = defineEquation({
  id: "schwarzschild-radius",
  text: "Rs = 2GM / c²",
  latex: "R_s = \\frac{2 G M}{c^2}",
  output: "Rs",
  variables: {
    M: { symbol: "M", latex: "M", unit: "kg" },
    Rs: { symbol: "Rs", latex: "R_s", unit: "m" },
  },
  compute: ({ M }) =>
    (2 * CONSTANTS.gravitationalConstant.value * M) / CONSTANTS.speedOfLight.value ** 2,
  source: "Schwarzschild (1916)",
});

/** Distance from annual parallax: the definition of the parsec. */
export const parallaxDistance = defineEquation({
  id: "parallax-distance",
  text: "d = 1 / p",
  latex: "d = \\frac{1}{p}",
  output: "d",
  variables: {
    p: { symbol: "p", latex: "p", unit: "arcsec" },
    d: { symbol: "d", latex: "d", unit: "pc" },
  },
  compute: ({ p }) => 1 / p,
});

/** GM/c³: the time light takes to cross one geometric mass. */
export const geometricMassTime = defineEquation({
  id: "geometric-mass-time",
  text: "t_M = GM / c³",
  latex: "t_M = \\frac{G M}{c^3}",
  output: "tM",
  variables: {
    M: { symbol: "M", latex: "M", unit: "kg" },
    tM: { symbol: "t_M", latex: "t_M", unit: "s" },
  },
  compute: ({ M }) =>
    (CONSTANTS.gravitationalConstant.value * M) / CONSTANTS.speedOfLight.value ** 3,
});

/**
 * Speed across the sky from proper motion and distance. With μ in ″/yr and d in
 * pc the factor is 1 au/yr in km/s (4.74047), derived here from the units.
 */
export const tangentialVelocity = defineEquation({
  id: "tangential-velocity",
  text: "v_t = μ d",
  latex: "v_t = \\mu d",
  output: "vt",
  variables: {
    mu: { symbol: "μ", latex: "\\mu", unit: "arcsec/yr" },
    d: { symbol: "d", latex: "d", unit: "pc" },
    vt: { symbol: "v_t", latex: "v_t", unit: "km/s" },
  },
  compute: ({ mu, d }) => (mu * UNITS["arcsec/yr"].factor * d * UNITS.pc.factor) / 1e3,
});

export const LAWS = {
  pythagoras,
  keplerThirdLaw,
  lightTravelTime,
  schwarzschildRadius,
  parallaxDistance,
  geometricMassTime,
  tangentialVelocity,
};
