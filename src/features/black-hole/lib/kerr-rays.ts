/**
 * Kerr null geodesics as the shader traces them, for the guide overlay and the
 * tests. Geometric units G = c = M = 1; `a` is the dimensionless spin, y the
 * spin axis, and φ = atan2(z, x) increases in the hole's direction of rotation
 * when a > 0. Boyer–Lindquist (r, θ, φ) are drawn as oblate-spheroidal
 * Cartesian points: x = √(r² + a²) sinθ cosφ, y = r cosθ, z = √(r² + a²) sinθ sinφ.
 *
 * Rays separate in Mino time λ (dλ = dλ_affine / Σ). With E, L and Carter's Q,
 * the radial motion in u = 1/r is a smooth, Binet-like oscillator:
 *   (du/dλ)² = U(u) = R(r)/r⁴ = (E + cu²)² − K(u² − 2u³ + a²u⁴)
 *   c = a(aE − L),   K = Q + (L − aE)²,   d²u/dλ² = U′/2
 * The polar motion is a free particle on the unit sphere with potential
 * −½a²E²cos²θ, so the unit vector s = (sinθ cosφ, cosθ, sinθ sinφ) obeys
 *   d²s/dλ² = −|ṡ|² s + a²E² cosθ (ŷ − cosθ s),   |ṡ|² = Q + L² + a²E² cos²θ
 * with no coordinate singularity at the poles. Frame dragging adds a rotation
 * about the spin axis at dφ/dλ = a(2Er − aL)/Δ. Velocity Verlet steps r and s;
 * |ṡ| is reset to its conserved value each step, so Q is kept exactly.
 *
 * The camera is a zero-angular-momentum observer (ZAMO): it exists at every
 * radius outside the horizon, and the frequency it measures sets g for the disk.
 */

import { circularOrbit } from "./disk-profile";
import { diskRedshift } from "./equations";
import { ESCAPE_RADIUS, STEP_FAR, STEP_FAR_GROWTH, STEP_NEAR, TRACE_STEPS } from "./parameters";
import { horizonOverM, photonOverM } from "./physics";

export type Vec3 = [number, number, number];

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a: Vec3): Vec3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

/** Boyer–Lindquist r and cosθ of an oblate-spheroidal Cartesian point. */
export function blRadius(p: Vec3, a: number): { r: number; mu: number } {
  const R2 = dot(p, p) - a * a;
  const r = Math.sqrt(0.5 * (R2 + Math.sqrt(R2 * R2 + 4 * a * a * p[1] * p[1])));
  return { r, mu: r > 0 ? p[1] / r : 0 };
}

/** Kerr metric functions at (r, cosθ): Σ, Δ, A, the lapse α, ω = −g_tφ/g_φφ and ϖ = √g_φφ. */
export function kerrMetric(r: number, mu: number, a: number) {
  const sin2 = Math.max(1 - mu * mu, 0);
  const sigma = r * r + a * a * mu * mu;
  const delta = r * r - 2 * r + a * a;
  const A = (r * r + a * a) ** 2 - a * a * delta * sin2;
  return {
    sigma,
    delta,
    A,
    alpha: Math.sqrt(Math.max((sigma * delta) / A, 0)),
    omega: (2 * a * r) / A,
    varpi: Math.sqrt((A / sigma) * sin2),
  };
}

/** Flat-space spherical unit vectors at a point: the ZAMO's local axes in the scene. */
function localAxes(s: Vec3) {
  const sinT = Math.hypot(s[0], s[2]);
  const cosP = sinT > 1e-9 ? s[0] / sinT : 1;
  const sinP = sinT > 1e-9 ? s[2] / sinT : 0;
  const er = s;
  const et: Vec3 = [s[1] * cosP, -sinT, s[1] * sinP];
  const ep: Vec3 = [-sinP, 0, cosP];
  return { er, et, ep, sinT };
}

type RayState = {
  /** Constants of the traced (time-reversed) ray; the arriving photon has −E, −L. */
  E: number;
  L: number;
  Q: number;
  /** u = 1/r and du/dλ. */
  u: number;
  ud: number;
  s: Vec3;
  sd: Vec3;
};

/**
 * The ray a ZAMO camera at `cam` sees along the unit direction `dir`, traced
 * backward from the camera. The photon arriving there is measured with unit
 * energy, so it carries E_photon = α − ωL_traced and L_photon = −L_traced.
 */
export function cameraRay(cam: Vec3, dir: Vec3, a: number): RayState {
  const { r, mu } = blRadius(cam, a);
  const sinT = Math.sqrt(Math.max(1 - mu * mu, 0));
  const cl = Math.hypot(cam[0], cam[2]);
  const s: Vec3 = cl > 1e-9 ? [(sinT * cam[0]) / cl, mu, (sinT * cam[2]) / cl] : [sinT, mu, 0];
  const { er, et, ep } = localAxes(s);
  const m = kerrMetric(r, mu, a);
  const nr = dot(dir, er);
  const nt = dot(dir, et);
  const np = dot(dir, ep);

  const L = m.varpi * np;
  const E = m.omega * L - m.alpha;
  const pTheta = Math.sqrt(m.sigma) * nt;
  const Q =
    pTheta * pTheta +
    mu * mu * (sinT > 1e-9 ? (L * L) / (sinT * sinT) : 0) -
    mu * mu * a * a * E * E;
  // ṡ = θ̇ e_θ + (L / sinθ) e_φ, with L / sinθ = √(A/Σ) n_φ: regular on the axis.
  const lift = Math.sqrt(m.A / m.sigma) * np;
  const sd: Vec3 = [
    pTheta * et[0] + lift * ep[0],
    pTheta * et[1] + lift * ep[1],
    pTheta * et[2] + lift * ep[2],
  ];
  // dr/dλ = √(ΣΔ) n_r, so du/dλ = −u² dr/dλ.
  return { E, L, Q, u: 1 / r, ud: (-Math.sqrt(m.sigma * m.delta) * nr) / (r * r), s, sd };
}

/** U(u) = R(1/u) u⁴; (du/dλ)² equals it along the ray. */
export function inversePotential(ray: Pick<RayState, "E" | "L" | "Q">, u: number, a: number) {
  const c = a * (a * ray.E - ray.L);
  const K = ray.Q + (ray.L - a * ray.E) ** 2;
  const w = ray.E + c * u * u;
  return w * w - K * u * u * (1 - 2 * u + a * a * u * u);
}

/** Carter's constant recomputed from a state; it should stay equal to Q. */
export function carterOf(ray: RayState, a: number) {
  const mu = ray.s[1];
  const sin2 = Math.max(1 - mu * mu, 1e-12);
  const thetaDot2 = dot(ray.sd, ray.sd) - (ray.L * ray.L) / sin2;
  return thetaDot2 + mu * mu * ((ray.L * ray.L) / sin2 - a * a * ray.E * ray.E);
}

/** Radius inside which an ingoing ray can no longer turn: halfway from r₊ to the prograde photon orbit. */
function captureRadius(a: number) {
  const rh = horizonOverM(a);
  return 0.5 * (rh + photonOverM(Math.abs(a)));
}

/** Fraction of the radius one step may move: finer near the hole, coarser far out where rays are nearly straight. */
function stepFraction(r: number) {
  return r < 8 ? STEP_NEAR : STEP_FAR * Math.min(Math.sqrt(r / 8), STEP_FAR_GROWTH);
}

/**
 * One velocity-Verlet step in Mino time, the shader's `kerrStep`. The step
 * moves the ray about `stepFraction(r)` of its radius.
 */
export function kerrStep(ray: RayState, a: number, refine = 1): RayState {
  const { E, L, Q, u, ud, s, sd } = ray;
  const c = a * (a * E - L);
  const K = Q + (L - a * E) ** 2;
  const sphere = Q + L * L;
  const a2E2 = a * a * E * E;
  const accU = (x: number) => 2 * c * x * (E + c * x * x) - K * x * (1 - 3 * x + 2 * a * a * x * x);
  const accS = (v: Vec3): Vec3 => {
    const mu = v[1];
    const k = sphere + a2E2 * mu * mu;
    const f = a2E2 * mu;
    return [-k * v[0] - f * mu * v[0], -k * v[1] + f * (1 - mu * v[1]), -k * v[2] - f * mu * v[2]];
  };
  const drag = (x: number) => (a * x * (2 * E - a * L * x)) / (1 - 2 * x + a * a * x * x);

  // |ds/dλ| is fixed by Carter's constant, so the step needs no length of ṡ.
  const speed2 = sphere + a2E2 * s[1] * s[1];
  const dl = stepFraction(1 / u) / Math.sqrt(Math.max((ud / u) ** 2 + speed2, 1e-18)) / refine;

  const a0 = accS(s);
  const udHalf = ud + 0.5 * dl * accU(u);
  const sdHalf: Vec3 = [
    sd[0] + 0.5 * dl * a0[0],
    sd[1] + 0.5 * dl * a0[1],
    sd[2] + 0.5 * dl * a0[2],
  ];
  const u1 = u + dl * udHalf;
  let s1 = norm([s[0] + dl * sdHalf[0], s[1] + dl * sdHalf[1], s[2] + dl * sdHalf[2]]);
  let ud1 = udHalf + 0.5 * dl * accU(u1);
  // Unless the ray turned during the step, reset du/dλ to ±√U.
  const U1 = inversePotential(ray, u1, a);
  if (U1 > 0 && ud1 * ud > 0) ud1 = Math.sign(ud1) * Math.sqrt(U1);
  const a1 = accS(s1);
  let sd1: Vec3 = [
    sdHalf[0] + 0.5 * dl * a1[0],
    sdHalf[1] + 0.5 * dl * a1[1],
    sdHalf[2] + 0.5 * dl * a1[2],
  ];
  // Back onto the sphere's tangent plane, at the speed Carter's constant fixes.
  const radial = dot(s1, sd1);
  sd1 = [sd1[0] - radial * s1[0], sd1[1] - radial * s1[1], sd1[2] - radial * s1[2]];
  const want = Math.sqrt(Math.max(sphere + a2E2 * s1[1] * s1[1], 0));
  const have = Math.hypot(...sd1);
  if (have > 1e-12) sd1 = [(sd1[0] * want) / have, (sd1[1] * want) / have, (sd1[2] * want) / have];

  // Frame dragging: a rotation about the spin axis, trapezoidal in u.
  const dphi = 0.5 * dl * (drag(u) + drag(u1));
  const cs = Math.cos(dphi);
  const sn = Math.sin(dphi);
  s1 = [cs * s1[0] - sn * s1[2], s1[1], sn * s1[0] + cs * s1[2]];
  sd1 = [cs * sd1[0] - sn * sd1[2], sd1[1], sn * sd1[0] + cs * sd1[2]];
  return { ...ray, u: u1, ud: ud1, s: s1, sd: sd1 };
}

type TraceResult = {
  outcome: "captured" | "escaped" | "exhausted";
  steps: number;
  ray: RayState;
  /** First equatorial crossing: Boyer–Lindquist radius, or NaN. */
  crossing: number;
};

/** Traces until capture, escape beyond `escapeR` moving outward, or `budget` steps. */
export function traceRay(
  cam: Vec3,
  dir: Vec3,
  a: number,
  {
    budget = TRACE_STEPS,
    escapeR = ESCAPE_RADIUS,
    refine = 1,
  }: { budget?: number; escapeR?: number; refine?: number } = {},
): TraceResult {
  let ray = cameraRay(cam, dir, a);
  const uCap = 1 / captureRadius(a);
  const uHorizon = 1 / (horizonOverM(a) * 1.001);
  let crossing = NaN;
  for (let i = 0; i < budget; i++) {
    if (ray.u > uHorizon || (ray.u > uCap && ray.ud > 0))
      return { outcome: "captured", steps: i, ray, crossing };
    if (ray.u * escapeR < 1 && ray.ud < 0) return { outcome: "escaped", steps: i, ray, crossing };
    const next = kerrStep(ray, a, refine);
    if (Number.isNaN(crossing) && ray.s[1] * next.s[1] <= 0) {
      const t = ray.s[1] / (ray.s[1] - next.s[1] || 1);
      crossing = 1 / (ray.u + (next.u - ray.u) * t);
    }
    ray = next;
  }
  return { outcome: "exhausted", steps: budget, ray, crossing };
}

type FlatTraceResult = {
  outcome: "captured" | "escaped" | "exhausted";
  steps: number;
  /** Where the march stopped; an escaped ray continues along `dir` from there. */
  position: Vec3;
  /** First equatorial crossing: Boyer–Lindquist radius of that scene point, or NaN. */
  crossing: number;
};

/**
 * The same scene with gravity off, the shader's flat-space branch: a straight
 * ray from a static camera, marched only along its chord through the sphere
 * of radius `escapeR` with the Kerr march's step lengths, until it meets the
 * dark ball of radius r₊ or leaves that sphere.
 */
export function traceFlatRay(
  cam: Vec3,
  dir: Vec3,
  a: number,
  { budget = TRACE_STEPS, escapeR = ESCAPE_RADIUS }: { budget?: number; escapeR?: number } = {},
): FlatTraceResult {
  const at = (t: number): Vec3 => [cam[0] + t * dir[0], cam[1] + t * dir[1], cam[2] + t * dir[2]];
  const rh = horizonOverM(a);
  const b = dot(cam, dir);
  const c = dot(cam, cam);
  const ballDisc = b * b - c + rh * rh;
  const tBall = ballDisc > 0 && b < 0 ? -b - Math.sqrt(ballDisc) : Infinity;
  const exitDisc = Math.max(b * b - c + escapeR * escapeR, 0);
  const tExit = -b + Math.sqrt(exitDisc);
  let t = Math.max(-b - Math.sqrt(exitDisc), 0);
  let crossing = NaN;
  let outcome: FlatTraceResult["outcome"] = tExit <= t ? "escaped" : "exhausted";
  let steps = 0;
  while (outcome === "exhausted" && steps < budget) {
    const prev = at(t);
    const r = Math.hypot(...prev);
    t = Math.min(t + stepFraction(r) * r, tBall, tExit);
    const pos = at(t);
    steps++;
    if (
      Number.isNaN(crossing) &&
      prev[1] * pos[1] <= 0 &&
      Math.abs(prev[1]) + Math.abs(pos[1]) > 0
    ) {
      const f = prev[1] / (prev[1] - pos[1]);
      const hit = prev.map((p, i) => p + (pos[i]! - p) * f);
      // The Boyer–Lindquist radius of that equatorial point.
      crossing = Math.sqrt(Math.max(hit[0]! ** 2 + hit[2]! ** 2 - a * a, 0));
    }
    if (t >= tBall) outcome = "captured";
    else if (t >= tExit) outcome = "escaped";
  }
  return { outcome, steps, position: at(t), crossing };
}

/**
 * Doppler factor g and rest-frame emission cosine for disk gas at
 * Boyer–Lindquist radius `rho` with gravity off, the shader's `flatShift`:
 * the gas circles at the Kerr Ω in flat space, and `dir` is the traced ray.
 */
export function flatDiskShift(hit: Vec3, dir: Vec3, rho: number, a: number) {
  const omega = 1 / (rho * Math.sqrt(rho) + a);
  const v: Vec3 = [-omega * hit[2], 0, omega * hit[0]];
  const g = Math.sqrt(1 - Math.min(dot(v, v), 0.98)) / Math.max(1 + dot(v, dir), 1e-4);
  return { g, mu: Math.min(g * Math.abs(dir[1]), 1) };
}

/**
 * Frequency ratio g = ν_camera / ν_emitted for disk gas on a prograde circular
 * orbit at r, the shader's `diskG`. The traced ray's constants are normalised
 * to the camera's frame, so g includes the camera's own shift.
 */
export function diskShift(ray: Pick<RayState, "E" | "L">, r: number, a: number) {
  const s = Math.sqrt(r);
  const omega = 1 / (r * s + a);
  const ut = (r * s + a) / (r ** 0.75 * Math.sqrt(Math.max(r * s - 3 * s + 2 * a, 1e-9)));
  // The arriving photon is the traced ray reversed: E = −E_traced, L = −L_traced.
  return diskRedshift.compute({ ut, omega, E: -ray.E, L: -ray.L });
}

/**
 * g for gas plunging inside the ISCO on a geodesic that keeps the ISCO's E and
 * L (Cunningham 1975), the shader's `plungeG`; `ud` is the traced ray's du/dλ.
 */
export function plungeShift(ray: RayState, r: number, ud: number, a: number, inner: number) {
  const { energy: eI, momentum: lI } = circularOrbit(inner, a);
  const delta = r * r - 2 * r + a * a;
  const bigA = (r * r + a * a) ** 2 - a * a * delta;
  const ut = (bigA * eI - 2 * a * r * lI) / (r * r * delta);
  const uphi = (2 * a * r * eI + (delta - a * a) * lI) / (r * r * delta);
  const p = eI * (r * r + a * a) - a * lI;
  const ur = -Math.sqrt(Math.max(p * p - delta * (r * r + (lI - a * eI) ** 2), 0)) / (r * r);
  const kr = (ud * r * r) / delta;
  return 1 / (-ray.E * ut + ray.L * uphi - kr * ur);
}

/**
 * The critical curve this camera sees: directions of photons that arrive from
 * the spherical photon orbits (Bardeen 1973; Teo 2003), expressed in the ZAMO
 * frame at the camera. Returns tangent-plane coordinates (x along `right`,
 * y along `up`) of a pinhole looking along `fwd`. Exact for the renderer's
 * camera; the dark region of the image need not coincide with it.
 */
export function criticalCurve(
  a: number,
  cam: Vec3,
  basis: { right: Vec3; up: Vec3; fwd: Vec3 },
  n = 160,
): [number, number][] {
  const aa = Math.abs(a) < 1e-4 ? 1e-4 * (a < 0 ? -1 : 1) : a;
  const { r: ro, mu } = blRadius(cam, aa);
  const sinT = Math.sqrt(Math.max(1 - mu * mu, 1e-12));
  const cl = Math.hypot(cam[0], cam[2]);
  const s: Vec3 = cl > 1e-9 ? [(sinT * cam[0]) / cl, mu, (sinT * cam[2]) / cl] : [sinT, mu, 0];
  const { er, et, ep } = localAxes(s);
  const m = kerrMetric(ro, mu, aa);

  // Spherical photon orbits with Ẽ = 1: λ = L/E and η = Q/E².
  const lambda = (r: number) => -(r ** 3 - 3 * r * r + aa * aa * r + aa * aa) / (aa * (r - 1));
  const eta = (r: number) =>
    -(r ** 3 * (r ** 3 - 6 * r * r + 9 * r - 4 * aa * aa)) / (aa * aa * (r - 1) ** 2);
  // Θ(θ_o) ≥ 0 selects the orbits this observer can see.
  const theta = (r: number) => {
    const l = lambda(r);
    return eta(r) + aa * aa * mu * mu - (l * l * mu * mu) / (sinT * sinT);
  };
  const r1 = photonOverM(Math.abs(aa));
  const r2 = photonOverM(-Math.abs(aa));
  let peak = r1;
  for (let i = 0; i <= 64; i++) {
    const r = r1 + ((r2 - r1) * i) / 64;
    if (theta(r) > theta(peak)) peak = r;
  }
  const edge = (lo: number, hi: number, rising: boolean) => {
    if (theta(rising ? lo : hi) >= 0) return rising ? lo : hi;
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;
      if (theta(mid) >= 0 === rising) hi = mid;
      else lo = mid;
    }
    return rising ? hi : lo;
  };
  const lo = edge(Math.min(r1, r2), peak, true);
  const hi = edge(peak, Math.max(r1, r2), false);

  const point = (r: number, sign: number): [number, number] => {
    // Photon with E = 1 arriving at the camera; the camera's local energy is (1 − ωλ)/α.
    const l = lambda(r);
    const local = (1 - m.omega * l) / m.alpha;
    const nPhi = -l / m.varpi / local;
    const nTheta = (sign * Math.sqrt(Math.max(theta(r), 0))) / Math.sqrt(m.sigma) / local;
    const rad = 1 - nPhi * nPhi - nTheta * nTheta;
    // Looking back along the photon: inward when the camera is outside the photon shell.
    const nR = (ro > r ? -1 : 1) * Math.sqrt(Math.max(rad, 0));
    const d: Vec3 = [
      nR * er[0] + nTheta * et[0] + nPhi * ep[0],
      nR * er[1] + nTheta * et[1] + nPhi * ep[1],
      nR * er[2] + nTheta * et[2] + nPhi * ep[2],
    ];
    const depth = dot(d, basis.fwd);
    return [dot(d, basis.right) / depth, dot(d, basis.up) / depth];
  };
  const upper: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const r = lo + ((hi - lo) * (1 - Math.cos((Math.PI * i) / n))) / 2;
    upper.push(point(r, 1));
  }
  const lower = upper.map((_, i) =>
    point(lo + ((hi - lo) * (1 - Math.cos((Math.PI * (n - i)) / n))) / 2, -1),
  );
  return [...upper, ...lower, upper[0]!];
}
