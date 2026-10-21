/**
 * Two-body orbits: the element formulas, Kepler's equation and positions in
 * the scene frame (frames.ts). Each formula is written once with
 * `defineEquation`, so a lab computes with it and prints the same object.
 */
import { defineEquation, keplerThirdLaw, RAD_PER_DEG as RAD } from "../science";
import type { Vec3 } from "./frames";

const TAU = Math.PI * 2;

/** JPL approximate elements: each one drifts linearly with time. */
export const secularElement = defineEquation({
  id: "secular-element",
  text: "x(T) = x₀ + ẋ T  (x = a, e, I, L, ϖ, Ω; T in Julian centuries from J2000)",
  latex: "x(T) = x_0 + \\dot{x}\\,T \\quad (x = a, e, I, L, \\varpi, \\Omega)",
  output: "x",
  variables: {
    x0: { symbol: "x₀", latex: "x_0" },
    rate: { symbol: "ẋ", latex: "\\dot{x}" },
    T: { symbol: "T", latex: "T", unit: "cy" },
    x: { symbol: "x", latex: "x" },
  },
  compute: ({ x0, rate, T }) => x0 + rate * T,
  source: "Standish & Williams, Keplerian Elements for Approximate Positions of the Major Planets",
});

export const argumentOfPerihelion = defineEquation({
  id: "argument-of-perihelion",
  text: "ω = ϖ − Ω",
  latex: "\\omega = \\varpi - \\Omega",
  output: "omega",
  variables: {
    varpi: { symbol: "ϖ", latex: "\\varpi", unit: "deg" },
    node: { symbol: "Ω", latex: "\\Omega", unit: "deg" },
    omega: { symbol: "ω", latex: "\\omega", unit: "deg" },
  },
  compute: ({ varpi, node }) => varpi - node,
});

export const meanAnomaly = defineEquation({
  id: "mean-anomaly",
  text: "M = L − ϖ",
  latex: "M = L - \\varpi",
  output: "M",
  variables: {
    L: { symbol: "L", latex: "L", unit: "deg" },
    varpi: { symbol: "ϖ", latex: "\\varpi", unit: "deg" },
    M: { symbol: "M", latex: "M", unit: "deg" },
  },
  compute: ({ L, varpi }) => L - varpi,
});

/** Solved for E by Newton–Raphson; M and E in radians. */
export const keplerEquation = defineEquation({
  id: "kepler-equation",
  text: "E − e sin E = M",
  latex: "E - e \\sin E = M",
  output: "E",
  variables: {
    M: { symbol: "M", latex: "M", unit: "rad" },
    e: { symbol: "e", latex: "e" },
    E: { symbol: "E", latex: "E", unit: "rad" },
  },
  compute: ({ M, e }) => {
    const m = ((M % TAU) + TAU) % TAU;
    let E = e < 0.8 ? m + e * Math.sin(m) : Math.PI;
    for (let k = 0; k < 50; k += 1) {
      const dE = (E - e * Math.sin(E) - m) / (1 - e * Math.cos(E));
      E -= dE;
      if (Math.abs(dE) < 1e-12) break;
    }
    return E;
  },
  source: "Kepler, Astronomia Nova (1609)",
});

export const perifocalX = defineEquation({
  id: "perifocal-x",
  text: "x′ = a (cos E − e)",
  latex: "x' = a(\\cos E - e)",
  output: "x",
  variables: {
    a: { symbol: "a", latex: "a", unit: "au" },
    e: { symbol: "e", latex: "e" },
    E: { symbol: "E", latex: "E", unit: "rad" },
    x: { symbol: "x′", latex: "x'", unit: "au" },
  },
  compute: ({ a, e, E }) => a * (Math.cos(E) - e),
});

export const perifocalY = defineEquation({
  id: "perifocal-y",
  text: "y′ = a √(1 − e²) sin E",
  latex: "y' = a\\sqrt{1 - e^2}\\,\\sin E",
  output: "y",
  variables: {
    a: { symbol: "a", latex: "a", unit: "au" },
    e: { symbol: "e", latex: "e" },
    E: { symbol: "E", latex: "E", unit: "rad" },
    y: { symbol: "y′", latex: "y'", unit: "au" },
  },
  compute: ({ a, e, E }) => a * Math.sqrt(1 - e * e) * Math.sin(E),
});

/** The orbit formulas above, for a lab's printed equation list. */
export const ORBIT_EQUATIONS = [
  secularElement,
  argumentOfPerihelion,
  meanAnomaly,
  keplerEquation,
  perifocalX,
  perifocalY,
] as const;

/** Classical elements. Angles in degrees; a in AU. */
export type Elements = {
  a: number;
  e: number;
  i: number;
  /** Argument of perihelion ω. */
  omega: number;
  /** Longitude of the ascending node Ω. */
  node: number;
  /** Mean anomaly M. */
  M: number;
};

/** Kepler's equation E − e sin E = M, Newton–Raphson, M and E in radians. */
export function eccentricAnomaly(M: number, e: number) {
  return keplerEquation.compute({ M, e });
}

/** Kepler's third law (shared): P in years from a in au. */
export function periodYears(a: number) {
  return keplerThirdLaw.compute({ a: Math.max(a, 1e-6) });
}

/** Rotate perifocal coordinates into the scene frame (X, up, −y). */
function toScene(xp: number, yp: number, i: number, omega: number, node: number, out: Vec3) {
  const cw = Math.cos(omega * RAD);
  const sw = Math.sin(omega * RAD);
  const cn = Math.cos(node * RAD);
  const sn = Math.sin(node * RAD);
  const ci = Math.cos(i * RAD);
  const si = Math.sin(i * RAD);
  const x = (cw * cn - sw * sn * ci) * xp + (-sw * cn - cw * sn * ci) * yp;
  const y = (cw * sn + sw * cn * ci) * xp + (-sw * sn + cw * cn * ci) * yp;
  const z = sw * si * xp + cw * si * yp;
  out[0] = x;
  out[1] = z;
  out[2] = -y;
  return out;
}

/** Heliocentric scene position for elements. Eccentricity is clamped below 1. */
export function keplerPosition(el: Elements, out: Vec3 = [0, 0, 0]): Vec3 {
  const e = Math.min(0.995, Math.max(0, el.e));
  const E = eccentricAnomaly(el.M * RAD, e);
  /* `perifocalX` and `perifocalY`, inline: this runs for every body every frame. */
  const xp = el.a * (Math.cos(E) - e);
  const yp = el.a * Math.sqrt(1 - e * e) * Math.sin(E);
  return toScene(xp, yp, el.i, el.omega, el.node, out);
}

/** Write the orbit ellipse sampled by true anomaly into a flat XYZ buffer. */
export function writeOrbit(out: Float32Array, el: Elements, elliptical: boolean) {
  const segments = out.length / 3 - 1;
  const e = elliptical ? Math.min(0.995, Math.max(0, el.e)) : 0;
  const i = elliptical ? el.i : 0;
  const p = el.a * (1 - e * e);
  // The orbital plane does not change between vertices. Rotate its basis once.
  const xAxis = toScene(1, 0, i, el.omega, el.node, [0, 0, 0]);
  const yAxis = toScene(0, 1, i, el.omega, el.node, [0, 0, 0]);
  for (let s = 0; s <= segments; s += 1) {
    const nu = (s / segments) * Math.PI * 2;
    const cos = Math.cos(nu);
    const r = p / (1 + e * cos);
    const x = r * cos;
    const y = r * Math.sin(nu);
    out[s * 3] = xAxis[0] * x + yAxis[0] * y;
    out[s * 3 + 1] = xAxis[1] * x + yAxis[1] * y;
    out[s * 3 + 2] = xAxis[2] * x + yAxis[2] * y;
  }
}

/** Mean anomaly moves a body along its orbit; it does not change the orbit geometry. */
export function createOrbitWriter(out: Float32Array) {
  let previous: { a: number; e: number; i: number; omega: number; node: number } | undefined;
  return (el: Elements, elliptical: boolean) => {
    const e = elliptical ? Math.min(0.995, Math.max(0, el.e)) : 0;
    const i = elliptical ? el.i : 0;
    if (
      previous &&
      previous.a === el.a &&
      previous.e === e &&
      previous.i === i &&
      previous.omega === el.omega &&
      previous.node === el.node
    )
      return false;
    writeOrbit(out, el, elliptical);
    previous = { a: el.a, e, i, omega: el.omega, node: el.node };
    return true;
  };
}
