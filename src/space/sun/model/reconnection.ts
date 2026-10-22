/**
 * Reduced kinematic reconnection in a vertical reference plane. One flux function defines
 * every field line, B=(∂y A,−∂x A), and E_z=−∂s A. Thus ∇·B=0 and Faraday's law hold
 * identically. The prescribed electric field transfers equal flux into the lower arcade
 * and upper magnetic island. It is NOT a solution of the momentum or energy equations.
 *
 * A compact resistive region regularises the X-point: E + v×B = ηJ, η≥0. The chosen
 * perpendicular velocity is a kinematic closure, not a momentum-equation prediction. Outside it,
 * ∂s A + v·∇A=0: the plotted flux contours move with the plasma. The height deformation
 * used for display is an additional ideal mapping, common to ALL contours.
 * Framework: Pontin & Priest 2022, Living Reviews in Solar Physics 19, 1,
 * https://doi.org/10.1007/s41116-022-00032-9. The analytic recipe itself is illustrative.
 */
import { clamp01 } from "@horizon/toolkit/math";

import { RECONNECTION as P, X_POINT_S } from "./parameters";

/** Flux transferred per unit invariant length, in the model's dimensionless units. */
export function transferredFluxAt(s: number) {
  const u = clamp01((s - X_POINT_S) / (1 - X_POINT_S));
  return P.transferredFlux * (1 - (1 - u) ** 4 * (1 + 4 * u));
}

/** The actual derivative of transferredFluxAt, not a separately animated light curve. */
export function fluxTransferRateAt(s: number) {
  const u = clamp01((s - X_POINT_S) / (1 - X_POINT_S));
  return (P.transferredFlux * 20 * u * (1 - u) ** 3) / (1 - X_POINT_S);
}

export type FluxSample = {
  a: number;
  ax: number;
  ay: number;
  current: number;
  electric: number;
};
export const blankFluxSample = (): FluxSample => ({ a: 0, ax: 0, ay: 0, current: 0, electric: 0 });

/** Evaluate A, its gradient, J_z=−∇²A and E_z in the reference plane. */
export function fluxAt(x: number, y: number, s: number, out = blankFluxSample()) {
  const u = y - 1;
  const t = x / P.sheetWidth;
  const abs = Math.abs(t);
  const logCosh = abs + Math.log1p(Math.exp(-2 * abs)) - Math.LN2;
  const tanh = Math.tanh(t);
  let w = 0;
  let wy = 0;
  let wyy = 0;
  if (y > 0 && y < 2) {
    const angle = (Math.PI * y) / 2;
    const sn = Math.sin(angle);
    const cs = Math.cos(angle);
    const gx = Math.exp(-((x / P.fluxWidth) ** 2));
    w = gx * sn ** 4;
    wy = gx * 2 * Math.PI * sn ** 3 * cs;
    wyy = gx * Math.PI ** 2 * (3 * sn ** 2 * cs ** 2 - sn ** 4);
  }
  const kx = (-2 * x) / P.fluxWidth ** 2;
  const wx = kx * w;
  const wxx = (kx * kx - 2 / P.fluxWidth ** 2) * w;
  const psi = transferredFluxAt(s);
  out.a = (u * u) / 2 - u ** 3 / 3 - P.fieldGradient * P.sheetWidth ** 2 * logCosh - psi * w;
  out.ax = -P.fieldGradient * P.sheetWidth * tanh - psi * wx;
  out.ay = u - u * u - psi * wy;
  out.current = P.fieldGradient * (1 - tanh * tanh) - (1 - 2 * u) + psi * (wxx + wyy);
  out.electric = fluxTransferRateAt(s) * w;
  return out;
}

const bump = (x: number) => (Math.abs(x) < 1 ? Math.cos((Math.PI * x) / 2) ** 4 : 0);
// Illustrative smoothing field: a quarter of the linear transverse field at the
// diffusion region's edge. This is not a measured resistivity or solar threshold.
const NULL_FIELD_SQUARED = ((P.fieldGradient * P.diffusionWidth) / 4) ** 2;
export type Transport = { vx: number; vy: number; resistivity: number };
const sample = blankFluxSample();

/**
 * Chosen perpendicular transport, continuous at both nulls. With χ the compact support,
 * D=B²+ε²χ, v=E∇A/D and η=Eε²χ/(JD), Ohm's law holds pointwise. At X, D stays positive
 * while ∇A vanishes; outside χ, the transport is ideal. This scalar, nonnegative η
 * assumes J>0 throughout the support, a property of this specific reference-plane recipe.
 */
export function transportAt(
  x: number,
  y: number,
  s: number,
  out: Transport = { vx: 0, vy: 0, resistivity: 0 },
) {
  fluxAt(x, y, s, sample);
  const support = bump(x / P.diffusionWidth) * bump((y - 1) / P.diffusionHeight);
  if (support > 0 && sample.current <= 0)
    throw new Error(
      "The reconnection closure requires positive current inside its diffusion region.",
    );
  const b2 = sample.ax ** 2 + sample.ay ** 2;
  const nonideal = NULL_FIELD_SQUARED * support;
  const denominator = b2 + nonideal;
  const speed = denominator > 0 ? sample.electric / denominator : 0;
  out.resistivity = support > 0 ? (speed * nonideal) / sample.current : 0;
  out.vx = speed * sample.ax;
  out.vy = speed * sample.ay;
  return out;
}

const rootSample = blankFluxSample();
/** Positive x on A=a. A is strictly decreasing with x>0 in this parameter range. */
export function contourX(y: number, a: number, s: number) {
  if (fluxAt(0, y, s, rootSample).a <= a) return 0;
  let lo = 0;
  let hi = 1;
  while (fluxAt(hi, y, s, rootSample).a > a) hi *= 2;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (fluxAt(mid, y, s, rootSample).a > a) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** An axial intersection, on one monotonic branch of A(0,y). */
export function contourY(a: number, s: number, lo: number, hi: number) {
  const rising = fluxAt(0, hi, s, rootSample).a > fluxAt(0, lo, s, rootSample).a;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (fluxAt(0, mid, s, rootSample).a < a === rising) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
