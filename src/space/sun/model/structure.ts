/**
 * The Sun's interior: Model S (Christensen-Dalsgaard et al. 1996), as `structure.json` holds it
 * (121 radii; `scripts/fetch-solar-structure.mjs`), read at any radius; the layer bounds that
 * follow from it; the mass, gravity and photon walk integrated over it.
 */
import { GRAVITATIONAL_CONSTANT, SPEED_OF_LIGHT } from "@horizon/toolkit/science";

import {
  CORE_LUMINOSITY_SHARE,
  PHOTOSPHERE_THICKNESS_KM,
  RADIUS_M,
  TACHOCLINE_R,
  TACHOCLINE_THICKNESS_R,
} from "./parameters";
import DATA from "./structure.json";

/** The model's run at one radius: temperature K, density kg/m³, pressure Pa, luminosity L/L☉, hydrogen mass fraction, opacity m²/kg. */
export type StructurePoint = {
  T: number;
  rho: number;
  P: number;
  L: number;
  X: number;
  kappa: number;
};

const COLUMN = { x: 0, T: 1, rho: 2, P: 3, L: 4, X: 5, kappa: 6 } as const;
/** Rows by radius, centre to photosphere. */
const ROWS: readonly (readonly number[])[] = DATA.rows;
const XS = ROWS.map((row) => row[COLUMN.x]!);

/** Where Model S comes from, for cards and the ledger. */
export const STRUCTURE_SOURCE = { reference: DATA.reference, fetched: DATA.fetched, url: DATA.url };
/** The table's radii and its number of them. */
export const STRUCTURE_RADII: readonly number[] = XS;

/** The row index just above `x` (1 … last), for interpolation. */
function upperIndex(x: number) {
  let lo = 1;
  let hi = XS.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (XS[mid]! < x) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

const column = (row: number, c: number) => ROWS[row]![c]!;
const logLinear = (a: number, b: number, t: number) =>
  Math.exp(Math.log(a) + (Math.log(b) - Math.log(a)) * t);
const linear = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * The model at radius `x` = r/R, 0–1 (clamped), interpolated between its rows: log-linearly in
 * temperature, density, pressure and opacity, linearly in luminosity and hydrogen. Writes into
 * `out` when given, so a probe allocates nothing.
 */
export function structureAt(
  x: number,
  out: StructurePoint = { T: 0, rho: 0, P: 0, L: 0, X: 0, kappa: 0 },
) {
  const xc = x <= 0 ? 0 : x >= 1 ? 1 : x;
  const hi = upperIndex(xc);
  const lo = hi - 1;
  const t = (xc - XS[lo]!) / (XS[hi]! - XS[lo]!);
  out.T = logLinear(column(lo, COLUMN.T), column(hi, COLUMN.T), t);
  out.rho = logLinear(column(lo, COLUMN.rho), column(hi, COLUMN.rho), t);
  out.P = logLinear(column(lo, COLUMN.P), column(hi, COLUMN.P), t);
  out.kappa = logLinear(column(lo, COLUMN.kappa), column(hi, COLUMN.kappa), t);
  out.L = linear(column(lo, COLUMN.L), column(hi, COLUMN.L), t);
  out.X = linear(column(lo, COLUMN.X), column(hi, COLUMN.X), t);
  return out;
}

/** The radius where the luminosity first reaches `share` of the total, by interpolation. */
function radiusOfLuminosity(share: number) {
  for (let i = 1; i < ROWS.length; i++) {
    const below = column(i - 1, COLUMN.L);
    const above = column(i, COLUMN.L);
    if (above >= share) return linear(XS[i - 1]!, XS[i]!, (share - below) / (above - below));
  }
  return 1;
}

/** The core's edge: where 99 % of the Sun's light is already made (~0.25 R). */
export const CORE_EDGE_R = radiusOfLuminosity(CORE_LUMINOSITY_SHARE);
export const PHOTOSPHERE_THICKNESS_R = (PHOTOSPHERE_THICKNESS_KM * 1e3) / RADIUS_M;

export type LayerId = "core" | "radiative" | "tachocline" | "convection" | "photosphere";
export type Layer = { id: LayerId; inner: number; outer: number };
/**
 * The layers a cut shows, inside out, in R: the core to where its light is made, the radiative
 * zone to the tachocline, the thin shear layer under the convection zone's base (Charbonneau
 * et al. 1999), the convection zone to the photosphere, the photosphere itself.
 */
export const LAYER_ZONES: readonly Layer[] = [
  { id: "core", inner: 0, outer: CORE_EDGE_R },
  { id: "radiative", inner: CORE_EDGE_R, outer: TACHOCLINE_R - TACHOCLINE_THICKNESS_R },
  { id: "tachocline", inner: TACHOCLINE_R - TACHOCLINE_THICKNESS_R, outer: TACHOCLINE_R },
  { id: "convection", inner: TACHOCLINE_R, outer: 1 },
  { id: "photosphere", inner: 1 - PHOTOSPHERE_THICKNESS_R, outer: 1 },
];
/** The named bounds, R: the core's edge, the tachocline (the convection zone's base), the surface. */
export const LAYERS = { core: CORE_EDGE_R, tachocline: TACHOCLINE_R, photosphere: 1 } as const;

/** The layer a radius lies in; the photosphere wins over the convection zone at the very top. */
export function layerAt(x: number): Layer {
  const photosphere = LAYER_ZONES[LAYER_ZONES.length - 1]!;
  if (x >= photosphere.inner) return photosphere;
  return LAYER_ZONES.find((layer) => x < layer.outer) ?? photosphere;
}

/* Mass inside each row by the trapezium rule over 4πr²ρ, and the gravity there. */
const MASS_KG: number[] = [0];
for (let i = 1; i < ROWS.length; i++) {
  const r0 = XS[i - 1]! * RADIUS_M;
  const r1 = XS[i]! * RADIUS_M;
  const shell0 = 4 * Math.PI * r0 * r0 * column(i - 1, COLUMN.rho);
  const shell1 = 4 * Math.PI * r1 * r1 * column(i, COLUMN.rho);
  MASS_KG.push(MASS_KG[i - 1]! + 0.5 * (shell0 + shell1) * (r1 - r0));
}
/** The mass the model holds inside the photosphere, kg (within a percent of M☉: the table's resolution). */
export const MODEL_MASS_KG = MASS_KG[MASS_KG.length - 1]!;

/** Mass inside radius `x`, kg. */
export function massAt(x: number) {
  const xc = x <= 0 ? 0 : x >= 1 ? 1 : x;
  const hi = upperIndex(xc);
  const t = (xc - XS[hi - 1]!) / (XS[hi]! - XS[hi - 1]!);
  return linear(MASS_KG[hi - 1]!, MASS_KG[hi]!, t);
}

/** Gravity at radius `x`, m/s² (G m(r) / r²; zero at the centre). */
export function gravityAt(x: number) {
  if (x <= 0) return 0;
  const r = x * RADIUS_M;
  return (GRAVITATIONAL_CONSTANT * massAt(x)) / (r * r);
}

/** Hydrostatic equilibrium: the pressure gradient a layer of density `rho` in gravity `g` needs, Pa/m. */
export const hydrostaticGradient = (rho: number, g: number) => -rho * g;

/** The table's own pressure gradient at `x`, Pa/m, by central difference over its neighbours. */
export function pressureGradientAt(x: number) {
  const hi = Math.min(ROWS.length - 1, Math.max(1, upperIndex(x)));
  const lo = hi - 1;
  return (column(hi, COLUMN.P) - column(lo, COLUMN.P)) / ((XS[hi]! - XS[lo]!) * RADIUS_M);
}

/**
 * Conventional shell random-walk estimate to the convection-zone base, not a photon's age
 * or a thermal relaxation time. Mitalas & Sills (1992), eq. 9, use
 * t = (3/c) Σ κρ Δ(r²), whose continuum limit is (6/c) ∫ κρ r dr.
 * Their discussion stops the walk at the convection-zone base: integrating a radiative
 * walk to the photosphere would ignore convection. Absorption/re-emission is not tracked.
 */
export const OPACITY_WALK_M = (() => {
  let integral = 0;
  for (let i = 1; i < ROWS.length; i++) {
    if (XS[i - 1]! >= TACHOCLINE_R) break;
    const r0 = XS[i - 1]! * RADIUS_M;
    const x1 = Math.min(XS[i]!, TACHOCLINE_R);
    const r1 = x1 * RADIUS_M;
    const f0 = column(i - 1, COLUMN.kappa) * column(i - 1, COLUMN.rho) * r0;
    const point = structureAt(x1);
    const f1 = point.kappa * point.rho * r1;
    integral += 0.5 * (f0 + f1) * (r1 - r0);
  }
  return integral;
})();
/** The diffusion time for a walk integral `ell` = ∫ κ ρ r dr (m), seconds. */
export const diffusionTime = (ell: number) => (6 * ell) / SPEED_OF_LIGHT;
/** The estimate for Model S, seconds. */
export const photonDiffusionTime = () => diffusionTime(OPACITY_WALK_M);
