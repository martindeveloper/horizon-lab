/**
 * Special relativity for a ship that flies at a real fraction of c: the sky's aberration and
 * Doppler shift and the clocks of coasting and torch-ship trips.
 *
 * The state is the proper velocity u = γβc in km/s (momentum per unit mass): it is
 * unbounded; β approaches 1 (and can round to 1 at extreme speeds). Under collinear
 * proper acceleration, du/dt = a and d(rapidity)/dτ = a/c. Distances are km, times s, accelerations m s⁻² so the
 * standard gravity can be passed as it is published.
 */
import { SPEED_OF_LIGHT, SPEED_OF_LIGHT_KM_S } from "./constants";
import { defineEquation } from "./equation";

/** Any x, y, z (a three.js Vector3 fits). Written in place; nothing is allocated. */
export type Vector3Like = { x: number; y: number; z: number };

const magnitude = (u: Vector3Like) => Math.hypot(u.x, u.y, u.z);

/** The Lorentz factor γ = √(1 + (u/c)²) of a proper velocity (km/s, scalar or vector). */
export function gammaOf(u: number | Vector3Like) {
  const speed = typeof u === "number" ? u : magnitude(u);
  return Math.hypot(1, speed / SPEED_OF_LIGHT_KM_S);
}

/** β = v/c of a proper velocity: its magnitude, or with `out` the β vector written there. */
export function betaOf(u: number | Vector3Like): number;
export function betaOf(u: Vector3Like, out: Vector3Like): Vector3Like;
export function betaOf(u: number | Vector3Like, out?: Vector3Like) {
  const speed = typeof u === "number" ? u : magnitude(u);
  const beta = speed / (SPEED_OF_LIGHT_KM_S * gammaOf(speed));
  if (typeof u === "number" || !out) return beta;
  const scale = beta / (speed || 1);
  out.x = u.x * scale;
  out.y = u.y * scale;
  out.z = u.z * scale;
  return out;
}

/** The proper velocity (km/s) of a β; the inverse of `betaOf` for a magnitude. */
export function properVelocity(beta: number) {
  return (beta * SPEED_OF_LIGHT_KM_S) / Math.sqrt(1 - beta * beta);
}

/**
 * Doppler factor D = ν_obs/ν_src = λ_src/λ_obs for light arriving from the direction at
 * angle θ from the velocity, measured in the source frame: D = γ(1 + β cos θ). Light from
 * dead ahead (cos θ = 1) is blueshifted by √((1 + β)/(1 − β)).
 */
export function relativisticDoppler(beta: number, gamma: number, cosTheta: number) {
  return gamma * (1 + beta * cosTheta);
}

/**
 * Aberration of a unit direction `n` (where a star is, in the rest frame) as seen by an
 * observer moving along the unit vector `forward` at β: the closed form
 * n′ = (n + forward ((γ − 1) c + γβ)) / (γ(1 + βc)) with c = n·forward. Directions crowd
 * towards `forward`. Written into `out`, which may be `n` itself.
 */
export function aberrate(
  n: Vector3Like,
  forward: Vector3Like,
  beta: number,
  gamma: number,
  out: Vector3Like,
) {
  const c = n.x * forward.x + n.y * forward.y + n.z * forward.z;
  const along = (gamma - 1) * c + gamma * beta;
  const scale = 1 / (gamma * (1 + beta * c));
  out.x = (n.x + forward.x * along) * scale;
  out.y = (n.y + forward.y * along) * scale;
  out.z = (n.z + forward.z * along) * scale;
  return out;
}

/** The clocks of a trip: coordinate time `t` (the Sun's) and proper time `tau` (the ship's), s. */
export type TripClocks = { t: number; tau: number };

/** Coasting a distance D (km) at a constant speed v (km/s): t = D/v, τ = t/γ. */
export function coastTrip(distanceKm: number, speedKmS: number): TripClocks {
  const t = distanceKm / speedKmS;
  const beta = speedKmS / SPEED_OF_LIGHT_KM_S;
  return { t, tau: t * Math.sqrt(1 - beta * beta) };
}

/**
 * The brachistochrone of a torch ship: accelerate at `a` (m s⁻²) to the midpoint and
 * decelerate to rest at D (km). Each half covers D/2 from rest, so with the one-way clocks
 * τ = 2 (c/a) acosh(1 + aD/(2c²)) and t = 2 (c/a) sinh(aτ/(2c)); `gammaMax` is γ at the
 * turnover, 1 + aD/(2c²).
 */
export function torchTrip(
  distanceKm: number,
  acceleration: number,
): TripClocks & { gammaMax: number } {
  const c = SPEED_OF_LIGHT;
  const a = acceleration;
  const gain = (a * distanceKm * 1e3) / (2 * c * c);
  const gammaMax = 1 + gain;
  // acosh(1 + x) = 2 asinh(sqrt(x/2)), without rounding a short trip's 1 + x to 1.
  const tau = (4 * c * Math.asinh(Math.sqrt(gain / 2))) / a;
  const t = (2 * c * Math.sqrt(gain) * Math.sqrt(gain + 2)) / a;
  return { t, tau, gammaMax };
}

/**
 * A ship accelerating at `a` (m s⁻²) for a proper time τ (s) from rest: the distance covered
 * (km), the coordinate time elapsed (s) and the proper velocity reached (km/s), from
 * x = (c²/a)(cosh(aτ/c) − 1), t = (c/a) sinh(aτ/c) and u = c sinh(aτ/c).
 */
export function torchOneWay(tau: number, acceleration: number) {
  if (acceleration === 0) return { distance: 0, t: tau, u: 0 };
  const c = SPEED_OF_LIGHT;
  const phi = (acceleration * tau) / c;
  const sinh = Math.sinh(phi);
  return {
    // cosh(phi) - 1 = 2 sinh(phi/2)² retains the Newtonian limit of a short burn.
    distance: ((2 * c * c) / acceleration) * Math.sinh(phi / 2) ** 2 * 1e-3,
    t: (c / acceleration) * sinh,
    u: SPEED_OF_LIGHT_KM_S * sinh,
  };
}

/* Teaching equations, so technical details can print them. */

export const lorentzFactor = defineEquation({
  id: "lorentz-factor",
  text: "γ = 1 / √(1 − β²)",
  latex: "\\gamma = \\frac{1}{\\sqrt{1 - \\beta^2}}",
  output: "gamma",
  variables: {
    beta: { symbol: "β", latex: "\\beta", unit: "c" },
    gamma: { symbol: "γ", latex: "\\gamma" },
  },
  compute: ({ beta }) => 1 / Math.sqrt(1 - beta * beta),
  source: "Lorentz (1904); Einstein (1905)",
});

/** The Sun's clock against the ship's: a trip of proper time τ at β takes t = γτ outside. */
export const timeDilation = defineEquation({
  id: "time-dilation",
  text: "t = τ / √(1 − β²)",
  latex: "t = \\frac{\\tau}{\\sqrt{1 - \\beta^2}}",
  output: "t",
  variables: {
    tau: { symbol: "τ", latex: "\\tau", unit: "s" },
    beta: { symbol: "β", latex: "\\beta", unit: "c" },
    t: { symbol: "t", latex: "t", unit: "s" },
  },
  compute: ({ tau, beta }) => tau / Math.sqrt(1 - beta * beta),
  source: "Einstein (1905)",
});

/** The frequency ratio of light arriving at θ (source frame) from the direction of travel. */
export const relativisticDopplerLaw = defineEquation({
  id: "relativistic-doppler",
  text: "ν′/ν = γ (1 + β cos θ)",
  latex: "\\frac{\\nu'}{\\nu} = \\gamma \\left(1 + \\beta \\cos\\theta\\right)",
  output: "D",
  variables: {
    beta: { symbol: "β", latex: "\\beta", unit: "c" },
    theta: { symbol: "θ", latex: "\\theta", unit: "deg" },
    D: { symbol: "ν′/ν", latex: "\\nu'/\\nu" },
  },
  compute: ({ beta, theta }) =>
    relativisticDoppler(beta, 1 / Math.sqrt(1 - beta * beta), Math.cos((theta * Math.PI) / 180)),
  source: "Einstein (1905)",
});

export const rapidity = defineEquation({
  id: "rapidity",
  text: "φ = atanh β",
  latex: "\\varphi = \\operatorname{artanh} \\beta",
  output: "phi",
  variables: {
    beta: { symbol: "β", latex: "\\beta", unit: "c" },
    phi: { symbol: "φ", latex: "\\varphi" },
  },
  compute: ({ beta }) => Math.atanh(beta),
  source: "Robb (1911)",
});
