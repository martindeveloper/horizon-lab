import { type Formula, defineEquation, schwarzschildRadius } from "@horizon/toolkit/science";

import { DISK_PEAK_K, LIMB_DARKENING, LIMB_NORMALIZATION } from "./parameters";

/** Numbers inside printed formulas: "15,800", "0.4213". */
const n = (value: number, digits = 4) =>
  value.toLocaleString("en", { maximumFractionDigits: digits });

/**
 * The observatory's formulas, each written once: `physics.ts` computes with
 * them, `technical.json` prints them by ID, and tests check them. Radii are in
 * geometric units of M (G = c = 1); `a` is the dimensionless spin.
 */

const spin = { symbol: "a", latex: "a" };
const radius = { symbol: "r", latex: "r" };

export const kerrHorizon = defineEquation({
  id: "kerr-horizon",
  text: "r₊/M = 1 + √(1 − a²)",
  latex: "\\frac{r_+}{M} = 1 + \\sqrt{1 - a^2}",
  output: "rh",
  variables: { a: spin, rh: { symbol: "r₊", latex: "r_+" } },
  compute: ({ a }) => 1 + Math.sqrt(Math.max(0, 1 - a * a)),
  source: "Kerr (1963); Bardeen, Press & Teukolsky (1972)",
});

export const photonOrbit = defineEquation({
  id: "photon-orbit",
  text: "r_ph/M = 2 [1 + cos((2/3) arccos(−a))]",
  latex: "\\frac{r_{ph}}{M} = 2\\left[1 + \\cos\\left(\\tfrac{2}{3}\\arccos(-a)\\right)\\right]",
  output: "rph",
  variables: { a: spin, rph: { symbol: "r_ph", latex: "r_{ph}" } },
  compute: ({ a }) => 2 * (1 + Math.cos((2 / 3) * Math.acos(-a))),
  source: "Bardeen, Press & Teukolsky (1972)",
});

export const innermostStableOrbit = defineEquation({
  id: "isco",
  text: [
    "Z₁ = 1 + ∛(1 − a²)[∛(1 + a) + ∛(1 − a)]",
    "Z₂ = √(3a² + Z₁²)",
    "r_ISCO/M = 3 + Z₂ − s√[(3 − Z₁)(3 + Z₁ + 2Z₂)]",
    "s = 1 for a ≥ 0; s = −1 otherwise",
  ].join("\n"),
  latex: [
    "\\begin{aligned}",
    "Z_1 &= 1 + \\sqrt[3]{1 - a^2}\\left[\\sqrt[3]{1 + a} + \\sqrt[3]{1 - a}\\right] \\\\",
    "Z_2 &= \\sqrt{3a^2 + Z_1^2} \\\\",
    "\\frac{r_{ISCO}}{M} &= 3 + Z_2 - s\\sqrt{(3 - Z_1)(3 + Z_1 + 2Z_2)}, \\quad s = \\operatorname{sgn} a",
    "\\end{aligned}",
  ].join("\n"),
  output: "risco",
  variables: { a: spin, risco: { symbol: "r_ISCO", latex: "r_{ISCO}" } },
  compute: ({ a }) => {
    const z1 = 1 + Math.cbrt(1 - a * a) * (Math.cbrt(1 + a) + Math.cbrt(1 - a));
    const z2 = Math.sqrt(3 * a * a + z1 * z1);
    return 3 + z2 - (a >= 0 ? 1 : -1) * Math.sqrt((3 - z1) * (3 + z1 + 2 * z2));
  },
  source: "Bardeen, Press & Teukolsky (1972), eq. 2.21",
});

/** Coordinate period of a prograde equatorial circular orbit, in units of GM/c³. */
export const kerrOrbitalPeriod = defineEquation({
  id: "kerr-orbital-period",
  text: "T = 2π [(r/M)^(3/2) + a] G M_phys / c³",
  latex: "T = 2\\pi\\left[\\left(\\frac{r}{M}\\right)^{3/2} + a\\right]\\frac{G M_{phys}}{c^3}",
  output: "T",
  variables: { r: radius, a: spin, T: { symbol: "T", latex: "T" } },
  compute: ({ r, a }) => 2 * Math.PI * (r ** 1.5 + a),
});

export const keplerAngularVelocity = defineEquation({
  id: "kerr-angular-velocity",
  text: "Ω = 1 / (r^(3/2) + a)",
  latex: "\\Omega = \\frac{1}{r^{3/2} + a}",
  output: "omega",
  variables: { r: radius, a: spin, omega: { symbol: "Ω", latex: "\\Omega" } },
  compute: ({ r, a }) => 1 / (r ** 1.5 + a),
});

/** Specific energy of a prograde equatorial circular orbit (Bardeen, Press & Teukolsky 1972, eq. 2.12). */
export const circularOrbitEnergy = defineEquation({
  id: "circular-orbit-energy",
  text: "E = (r^(3/2) − 2r^(1/2) + a) / [r^(3/4) √(r^(3/2) − 3r^(1/2) + 2a)]",
  latex: "E = \\frac{r^{3/2} - 2r^{1/2} + a}{r^{3/4}\\sqrt{r^{3/2} - 3r^{1/2} + 2a}}",
  output: "E",
  variables: { r: radius, a: spin, E: { symbol: "E", latex: "E" } },
  compute: ({ r, a }) => {
    const s = Math.sqrt(r);
    return (r * s - 2 * s + a) / (r ** 0.75 * Math.sqrt(r * s - 3 * s + 2 * a));
  },
  source: "Bardeen, Press & Teukolsky (1972), eq. 2.12",
});

/** Specific angular momentum of the same orbit (eq. 2.13). */
export const circularOrbitMomentum = defineEquation({
  id: "circular-orbit-momentum",
  text: "L = (r² − 2a r^(1/2) + a²) / [r^(3/4) √(r^(3/2) − 3r^(1/2) + 2a)]",
  latex: "L = \\frac{r^2 - 2a\\,r^{1/2} + a^2}{r^{3/4}\\sqrt{r^{3/2} - 3r^{1/2} + 2a}}",
  output: "L",
  variables: { r: radius, a: spin, L: { symbol: "L", latex: "L" } },
  compute: ({ r, a }) => {
    const s = Math.sqrt(r);
    return (r * r - 2 * a * s + a * a) / (r ** 0.75 * Math.sqrt(r * s - 3 * s + 2 * a));
  },
  source: "Bardeen, Press & Teukolsky (1972), eq. 2.13",
});

/**
 * Frequency factor of a circular equatorial emitter seen by the camera. The
 * photon's E and L are normalised so the camera measures unit energy, which
 * folds the camera's own gravitational and frame-dragging shift into g.
 */
export const diskRedshift = defineEquation({
  id: "disk-redshift",
  text: "g = 1 / [uᵗ(E − ΩL)],  −p·u_camera = 1;  I ∝ g⁴",
  latex: "g = \\frac{1}{u^t(E - \\Omega L)}, \\quad -p \\cdot u_{cam} = 1, \\quad I \\propto g^4",
  output: "g",
  variables: {
    ut: { symbol: "uᵗ", latex: "u^t" },
    omega: { symbol: "Ω", latex: "\\Omega" },
    E: { symbol: "E", latex: "E" },
    L: { symbol: "L", latex: "L" },
    g: { symbol: "g", latex: "g" },
  },
  compute: ({ ut, omega, E, L }) => 1 / (ut * (E - omega * L)),
  source: "Cunningham & Bardeen (1973); Cunningham (1975)",
});

/** Emission angle from the disk normal in the gas's rest frame, on the equator. */
export const emissionAngle = defineEquation({
  id: "emission-angle",
  text: "μ_em = g √Q / r",
  latex: "\\mu_{em} = \\frac{g\\sqrt{Q}}{r}",
  output: "mu",
  variables: {
    g: { symbol: "g", latex: "g" },
    Q: { symbol: "Q", latex: "Q" },
    r: radius,
    mu: { symbol: "μ_em", latex: "\\mu_{em}" },
  },
  compute: ({ g, Q, r }) => Math.min(1, (g * Math.sqrt(Math.max(Q, 0))) / r),
});

/** Electron-scattering limb darkening, normalised to an isotropic emitter's flux. */
export const limbDarkening = defineEquation({
  id: "limb-darkening",
  text: `I(μ) = ${n(LIMB_NORMALIZATION)} (1 + ${n(LIMB_DARKENING)} μ)`,
  latex: `I(\\mu) = ${n(LIMB_NORMALIZATION)}\\,(1 + ${n(LIMB_DARKENING)}\\,\\mu)`,
  output: "I",
  variables: { mu: { symbol: "μ", latex: "\\mu" }, I: { symbol: "I", latex: "I" } },
  compute: ({ mu }) => LIMB_NORMALIZATION * (1 + LIMB_DARKENING * mu),
  source: "Chandrasekhar, Radiative Transfer (1960)",
});

/** Display temperature of the disk: T ∝ F^(1/4), peaking at a fixed display scale. */
export const diskTemperature = defineEquation({
  id: "disk-temperature",
  text: `T_em = ${n(DISK_PEAK_K)} K × (F/F_peak × texture)^(1/4) × temperature scale × preset factor`,
  latex: `T_{em} = ${n(DISK_PEAK_K).replace(",", "\\,")}\\,\\mathrm{K}\\left(\\frac{F}{F_{peak}}\\,\\mathrm{texture}\\right)^{1/4} s_T\\,f_{preset}`,
  output: "T",
  variables: {
    flux: { symbol: "F/F_peak × texture", latex: "\\frac{F}{F_{peak}}\\,\\mathrm{texture}" },
    scale: { symbol: "temperature scale × preset factor", latex: "s_T f_{preset}" },
    T: { symbol: "T_em", latex: "T_{em}", unit: "K" },
  },
  compute: ({ flux, scale }) => DISK_PEAK_K * flux ** 0.25 * scale,
});

/** Rain observer, released from rest at infinity (E = 1). */
export const rainClockRate = defineEquation({
  id: "rain-clock-rate",
  text: "dτ/dT = 1 − 2/r",
  latex: "\\frac{d\\tau}{dT} = 1 - \\frac{2}{r}",
  output: "rate",
  variables: { r: radius, rate: { symbol: "dτ/dT", latex: "\\frac{d\\tau}{dT}" } },
  compute: ({ r }) => 1 - 2 / r,
});

export const rainFallSpeed = defineEquation({
  id: "rain-fall-speed",
  text: "dr/dT = −(1 − 2/r)√(2/r)",
  latex: "\\frac{dr}{dT} = -\\left(1 - \\frac{2}{r}\\right)\\sqrt{\\frac{2}{r}}",
  output: "speed",
  variables: { r: radius, speed: { symbol: "dr/dT", latex: "\\frac{dr}{dT}" } },
  compute: ({ r }) => -(1 - 2 / r) * Math.sqrt(2 / r),
});

/** Every formula `technical.json` may reference by ID. */
export const BLACK_HOLE_EQUATIONS = Object.fromEntries<Formula>(
  [
    schwarzschildRadius,
    kerrHorizon,
    photonOrbit,
    innermostStableOrbit,
    kerrOrbitalPeriod,
    keplerAngularVelocity,
    circularOrbitEnergy,
    circularOrbitMomentum,
    diskRedshift,
    emissionAngle,
    limbDarkening,
    diskTemperature,
    rainClockRate,
    rainFallSpeed,
  ].map((equation) => [equation.id, equation]),
);
