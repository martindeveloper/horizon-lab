import { BOLTZMANN_CONSTANT, ATOMIC_MASS_KG, CONSTANTS, RAD_PER_DEG } from "./constants";
import { defineEquation } from "./equation";
import { UNITS } from "./units";

/**
 * Laws shared by every simulation. A simulation's own formulas (Kerr radii,
 * migration sketches) live in the feature, built with `defineEquation` too.
 */

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

/** A Schwarzschild hole's photon sphere, in horizon radii: r = 3GM/c². */
export const PHOTON_SPHERE_PER_RS = 1.5;
/**
 * Its critical impact parameter, in horizon radii: b = r / √(1 − Rs/r) at the photon sphere,
 * 3√3 GM/c². Rays aimed inside it fall in, so it is the shadow's radius on a distant sky.
 */
export const SHADOW_PER_RS = PHOTON_SPHERE_PER_RS / Math.sqrt(1 - 1 / PHOTON_SPHERE_PER_RS);

export const photonSphereRadius = defineEquation({
  id: "photon-sphere",
  text: "r_ph = 3GM / c²",
  latex: "r_{\\rm ph} = \\frac{3GM}{c^2}",
  output: "r",
  variables: {
    M: { symbol: "M", latex: "M", unit: "kg" },
    r: { symbol: "r_ph", latex: "r_{\\rm ph}", unit: "m" },
  },
  compute: ({ M }) => PHOTON_SPHERE_PER_RS * schwarzschildRadius.compute({ M }),
});

export const shadowRadius = defineEquation({
  id: "critical-impact",
  text: "b_c = 3√3 GM / c²",
  latex: "b_c = \\frac{3\\sqrt{3}GM}{c^2}",
  output: "b",
  variables: {
    M: { symbol: "M", latex: "M", unit: "kg" },
    b: { symbol: "b_c", latex: "b_c", unit: "m" },
  },
  compute: ({ M }) => SHADOW_PER_RS * schwarzschildRadius.compute({ M }),
  source: "Synge (1966); Luminet (1979)",
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

/**
 * Angle between two directions on the sky (right ascension and declination, or any
 * longitude and latitude), by the haversine form, which stays accurate for small angles.
 */
export const angularSeparation = defineEquation({
  id: "angular-separation",
  text: "θ = 2 asin √(sin²(Δδ/2) + cos δ₁ cos δ₂ sin²(Δα/2))",
  latex:
    "\\theta = 2 \\arcsin \\sqrt{\\sin^2\\tfrac{\\Delta\\delta}{2} + \\cos\\delta_1 \\cos\\delta_2 \\sin^2\\tfrac{\\Delta\\alpha}{2}}",
  output: "theta",
  variables: {
    ra1: { symbol: "α₁", latex: "\\alpha_1", unit: "deg" },
    dec1: { symbol: "δ₁", latex: "\\delta_1", unit: "deg" },
    ra2: { symbol: "α₂", latex: "\\alpha_2", unit: "deg" },
    dec2: { symbol: "δ₂", latex: "\\delta_2", unit: "deg" },
    theta: { symbol: "θ", latex: "\\theta", unit: "deg" },
  },
  compute: ({ ra1, dec1, ra2, dec2 }) => {
    const h =
      Math.sin(((dec2 - dec1) * RAD_PER_DEG) / 2) ** 2 +
      Math.cos(dec1 * RAD_PER_DEG) *
        Math.cos(dec2 * RAD_PER_DEG) *
        Math.sin(((ra2 - ra1) * RAD_PER_DEG) / 2) ** 2;
    return (2 * Math.asin(Math.sqrt(Math.min(1, h)))) / RAD_PER_DEG;
  },
  source: "Sinnott 1984, Sky & Telescope 68, 159",
});

/**
 * Where a mean-motion resonance with a planet sits: Kepler's third law for an orbit
 * whose period is `k` times the planet's (¼ for Jupiter's 4:1 Kirkwood gap, 3/2 for
 * Neptune's plutinos).
 */
export const resonanceSemiMajorAxis = defineEquation({
  id: "resonance-semi-major-axis",
  text: "a = a_p k^(2/3),  k = P / P_p",
  latex: "a = a_p\\,k^{2/3}, \\quad k = P / P_p",
  output: "a",
  variables: {
    ap: { symbol: "a_p", latex: "a_p", unit: "au" },
    k: { symbol: "k", latex: "k" },
    a: { symbol: "a", latex: "a", unit: "au" },
  },
  compute: ({ ap, k }) => ap * k ** (2 / 3),
  source: "Kepler, Harmonices Mundi (1619)",
});

/** Hubble's law: the distance of a galaxy receding at v in the smooth expansion. */
export const hubbleLaw = defineEquation({
  id: "hubble-law",
  text: "d = v / H₀",
  latex: "d = \\frac{v}{H_0}",
  output: "d",
  variables: {
    v: { symbol: "v", latex: "v", unit: "km/s" },
    H0: { symbol: "H₀", latex: "H_0", unit: "km/s/Mpc" },
    d: { symbol: "d", latex: "d", unit: "Mpc" },
  },
  compute: ({ v, H0 }) => v / H0,
  source: "Hubble 1929, PNAS 15, 168; Lemaître 1927",
});

/** Stefan–Boltzmann in solar units: how a star's radius and temperature set its power. */
export const stefanBoltzmann = defineEquation({
  id: "stefan-boltzmann",
  text: "L / L☉ = (R / R☉)² (T / T☉)⁴",
  latex:
    "\\frac{L}{L_\\odot} = \\left(\\frac{R}{R_\\odot}\\right)^2 \\left(\\frac{T}{T_\\odot}\\right)^4",
  output: "L",
  variables: {
    R: { symbol: "R / R☉", latex: "R/R_\\odot" },
    T: { symbol: "T", latex: "T", unit: "K" },
    L: { symbol: "L / L☉", latex: "L/L_\\odot" },
  },
  compute: ({ R, T }) => R ** 2 * (T / CONSTANTS.solarEffectiveTemperature.value) ** 4,
  source: "Stefan (1879), Boltzmann (1884)",
});

/**
 * An atmosphere's pressure scale height: how far up its pressure falls by a factor e, for a
 * gas of mean particle mass μ (in atomic mass units) under gravity g.
 */
export const pressureScaleHeight = defineEquation({
  id: "scale-height",
  text: "H = kT / (μ mᵤ g)",
  latex: "H = \\frac{k T}{\\mu\\, m_u\\, g}",
  output: "H",
  variables: {
    T: { symbol: "T", latex: "T", unit: "K" },
    mu: { symbol: "μ", latex: "\\mu" },
    g: { symbol: "g", latex: "g" },
    H: { symbol: "H", latex: "H", unit: "m" },
  },
  compute: ({ T, mu, g }) => (BOLTZMANN_CONSTANT * T) / (mu * ATOMIC_MASS_KG * g),
});

/** Mean density: a body's mass spread evenly through its sphere. */
export const meanDensity = defineEquation({
  id: "mean-density",
  text: "ρ = 3M / (4πR³)",
  latex: "\\rho = \\frac{3 M}{4 \\pi R^3}",
  output: "rho",
  variables: {
    M: { symbol: "M", latex: "M", unit: "kg" },
    R: { symbol: "R", latex: "R", unit: "m" },
    rho: { symbol: "ρ", latex: "\\rho" },
  },
  compute: ({ M, R }) => M / ((4 / 3) * Math.PI * R ** 3),
});
