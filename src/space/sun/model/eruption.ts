/**
 * One eruption, after Lin & Forbes 2000 (JGR 105, 2375; the Forbes–Isenberg catastrophe model
 * with reconnection): a flux rope, a line current at height h over the photosphere with its
 * image below, held down by a bipolar field from two sources at x = ±λ, and, once the rope has
 * lost equilibrium, a vertical current sheet from y = p to y = q beneath it. The field of the
 * whole is one closed form (their eq. 1, as Forbes, Seaton & Reeves 2018 restate it):
 *
 *   B_y + i B_x = 2i A₀ λ (h² + λ²) √((z² + p²)(z² + q²))
 *                 / [π (z² − λ²)(z² + h²) √((λ² + p²)(λ² + q²))],   z = x + iy.
 *
 * Lengths are in λ₀, the half-separation of the sources at the critical point (`ERUPTION_SCALE_R`
 * in R☉); A₀ = 1. One parameter s runs the sequence: sources converge and the rope rises along
 * its equilibrium branch (storage), loses equilibrium and rises (an X-point forms beneath it and
 * stretches into a sheet), reconnects as it breaks loose (the flare, the ejection), and leaves
 * post-flare loops filling in under the rising sheet bottom while the ribbons separate. Field
 * lines are streamlines of the closed form, traced from the sources.
 */
import { clamp01, smoothstep } from "@horizon/toolkit/math";

import {
  CME_FINAL_HEIGHT_R,
  CME_SPREAD_RAD,
  ERUPTION_LINES,
  ERUPTION_SCALE_R,
  ERUPTION_STAGES,
  FLARE_LIGHT_DECAY_S01,
  POST_FLARE_TOP,
  RIBBON_HEIGHT,
  ROPE_HEIGHT_AT_BREAKAWAY,
  ROPE_RADIUS,
  SHEET_GAP,
  STORAGE_LAMBDA,
  X_POINT_S,
  X_POINT_SHARE,
} from "./parameters";

/** The configuration at one moment, in λ₀: source half-separation, rope height and radius, sheet ends. */
export type Geometry = { lambda: number; h: number; rope: number; p: number; q: number };

/** The rope's radius grows as the root of its height once it rises (self-similar expansion). */
const ropeRadius = (h: number) => ROPE_RADIUS * Math.sqrt(Math.max(1, h));

/* The rise after loss of equilibrium: h − 1 = a u² e^{bu}, through the breakaway height and the final one. */
const FINAL_HEIGHT = CME_FINAL_HEIGHT_R / ERUPTION_SCALE_R;
const U_BREAKAWAY =
  (ERUPTION_STAGES.rise - ERUPTION_STAGES.storage) / (1 - ERUPTION_STAGES.storage);
const RISE_B =
  Math.log(((FINAL_HEIGHT - 1) / (ROPE_HEIGHT_AT_BREAKAWAY - 1)) * U_BREAKAWAY ** 2) /
  (1 - U_BREAKAWAY);
const RISE_A = (FINAL_HEIGHT - 1) * Math.exp(-RISE_B);

/** The rope's height at `s`, λ₀. */
export function ropeHeight(s: number) {
  const { storage } = ERUPTION_STAGES;
  if (s < storage) {
    /* Along the lower equilibrium branch as the sources converge: h λ = λ₀² stands in for it. */
    const lambda = STORAGE_LAMBDA[0] + (STORAGE_LAMBDA[1] - STORAGE_LAMBDA[0]) * (s / storage);
    return 1 / lambda;
  }
  const u = (s - storage) / (1 - storage);
  return 1 + RISE_A * u * u * Math.exp(RISE_B * u);
}

/** The geometry at `s`, 0–1. */
export function geometryAt(
  s: number,
  out: Geometry = { lambda: 1, h: 1, rope: ROPE_RADIUS, p: 0, q: 0 },
) {
  const t = clamp01(s);
  const { storage, breakaway } = ERUPTION_STAGES;
  out.lambda =
    t < storage
      ? STORAGE_LAMBDA[0] + (STORAGE_LAMBDA[1] - STORAGE_LAMBDA[0]) * (t / storage)
      : STORAGE_LAMBDA[1];
  out.h = ropeHeight(t);
  out.rope = ropeRadius(out.h);
  if (t < X_POINT_S) {
    out.p = 0;
    out.q = 0;
    return out;
  }
  const xPoint = X_POINT_SHARE * ropeHeight(X_POINT_S);
  const under = out.h - out.rope - SHEET_GAP;
  out.q = xPoint + (under - xPoint) * smoothstep(X_POINT_S, breakaway, t);
  out.p = xPoint + (POST_FLARE_TOP - xPoint) * smoothstep(X_POINT_S, 1, t);
  if (out.p > out.q) out.p = out.q;
  return out;
}

/* Complex helpers on (re, im) pairs, without allocation. */
const sq = { re: 0, im: 0 };
function csqrt(re: number, im: number, out: { re: number; im: number }) {
  const m = Math.hypot(re, im);
  out.re = Math.sqrt(Math.max(0, (m + re) / 2));
  out.im = Math.sign(im || 1) * Math.sqrt(Math.max(0, (m - re) / 2));
  if (im === 0 && re < 0) out.im = Math.sqrt(-re);
  return out;
}

export type PlaneField = { bx: number; by: number };

/** The field of the closed form at (x, y) in λ₀, in units of A₀/λ₀; zero at the sources and inside the rope. */
export function planeFieldAt(
  x: number,
  y: number,
  g: Geometry,
  out: PlaneField = { bx: 0, by: 0 },
) {
  const { lambda, h, p, q } = g;
  /* z² */
  const z2re = x * x - y * y;
  const z2im = 2 * x * y;
  /* √(z² + p²) √(z² + q²) */
  csqrt(z2re + p * p, z2im, sq);
  const s1re = sq.re;
  const s1im = sq.im;
  csqrt(z2re + q * q, z2im, sq);
  const sre = s1re * sq.re - s1im * sq.im;
  const sim = s1re * sq.im + s1im * sq.re;
  /* denominator (z² − λ²)(z² + h²) */
  const d1re = z2re - lambda * lambda;
  const d2re = z2re + h * h;
  const dre = d1re * d2re - z2im * z2im;
  const dim = d1re * z2im + z2im * d2re;
  const d2 = dre * dre + dim * dim;
  if (d2 < 1e-30) {
    out.bx = 0;
    out.by = 0;
    return out;
  }
  /* W = k · i · S / D, k real */
  const k =
    (2 * lambda * (h * h + lambda * lambda)) /
    (Math.PI * Math.sqrt((lambda * lambda + p * p) * (lambda * lambda + q * q)));
  /* i S = (−sim, sre) */
  const nre = -sim;
  const nim = sre;
  const wre = (k * (nre * dre + nim * dim)) / d2;
  const wim = (k * (nim * dre - nre * dim)) / d2;
  out.by = wre;
  out.bx = wim;
  return out;
}

/** The field along the sheet's outside, p < y < q (their eq. 17), in A₀/λ₀. */
export function sheetFieldAt(y: number, g: Geometry) {
  const { lambda, h, p, q } = g;
  if (y <= p || y >= q) return 0;
  return (
    (2 * lambda * (h * h + lambda * lambda) * Math.sqrt((y * y - p * p) * (q * q - y * y))) /
    (Math.PI *
      (y * y + lambda * lambda) *
      Math.abs(h * h - y * y) *
      Math.sqrt((lambda * lambda + p * p) * (lambda * lambda + q * q)))
  );
}

/*
 * The reconnection rate is the electric field at the sheet, E ∝ v_A B ∝ B², read at its
 * midpoint, and the flare's light its release of energy integrated with a slow decay; both are
 * tabulated over the timeline once and normalised to peak at 1.
 */
const SAMPLES = 400;
const RATE = new Float64Array(SAMPLES + 1);
const LIGHT = new Float64Array(SAMPLES + 1);
{
  const g = geometryAt(0);
  let peakRate = 0;
  for (let i = 0; i <= SAMPLES; i++) {
    geometryAt(i / SAMPLES, g);
    const b = sheetFieldAt((g.p + g.q) / 2, g);
    RATE[i] = b * b;
    peakRate = Math.max(peakRate, RATE[i]!);
  }
  let light = 0;
  let peakLight = 0;
  const ds = 1 / SAMPLES;
  for (let i = 0; i <= SAMPLES; i++) {
    RATE[i] = peakRate > 0 ? RATE[i]! / peakRate : 0;
    light = light * Math.exp(-ds / FLARE_LIGHT_DECAY_S01) + RATE[i]! * ds;
    LIGHT[i] = light;
    peakLight = Math.max(peakLight, light);
  }
  for (let i = 0; i <= SAMPLES; i++) LIGHT[i] = peakLight > 0 ? LIGHT[i]! / peakLight : 0;
}
const sampled = (table: Float64Array, s: number) => {
  const u = clamp01(s) * SAMPLES;
  const i = Math.min(SAMPLES - 1, Math.floor(u));
  return table[i]! + (table[i + 1]! - table[i]!) * (u - i);
};
/** Reconnection rate at `s`, 0–1 of its peak; 0 until the X-point opens into a sheet. */
export const reconnectionAt = (s: number) => sampled(RATE, s);
/** The flare's light at `s`, 0–1 of its peak. */
export const flareLightAt = (s: number) => sampled(LIGHT, s);

/** A field line in the vertical plane: xy pairs in λ₀, and what it is. */
export type PlaneLine = {
  points: Float32Array;
  count: number;
  kind: "arcade" | "postflare" | "rope" | "open";
};
export const PLANE_LINE_POINTS = 160;
export const blankPlaneLine = (): PlaneLine => ({
  points: new Float32Array(2 * PLANE_LINE_POINTS),
  count: 0,
  kind: "arcade",
});

/** Launch radius about a source, and the box a line is open beyond. */
const LAUNCH = 0.02;
const BOX = 4;
const b: PlaneField = { bx: 0, by: 0 };

/** The unit field direction at (x, y) times `sign`, into `out`. */
function dir(x: number, y: number, g: Geometry, sign: number, out: [number, number]) {
  planeFieldAt(x, y, g, b);
  const n = Math.hypot(b.bx, b.by) || 1;
  out[0] = (sign * b.bx) / n;
  out[1] = (sign * b.by) / n;
}
const d1: [number, number] = [0, 0];
const d2: [number, number] = [0, 0];
const d3: [number, number] = [0, 0];
const d4: [number, number] = [0, 0];

/**
 * Traces the streamline from (x, y) along the field (`sign` picks the way) until it lands on
 * the photosphere, enters the rope, or leaves the box; writes `line`, returns where it stopped.
 */
export function tracePlaneLine(
  x0: number,
  y0: number,
  g: Geometry,
  sign: number,
  line: PlaneLine,
  maxPoints = PLANE_LINE_POINTS,
): "landed" | "rope" | "open" | "stuck" {
  let x = x0;
  let y = y0;
  let count = 0;
  const put = () => {
    line.points[2 * count] = x;
    line.points[2 * count + 1] = y;
    count++;
  };
  put();
  const box = BOX * Math.max(g.h, 1);
  let outcome: "landed" | "rope" | "open" | "stuck" = "stuck";
  while (count < Math.min(maxPoints, line.points.length / 2)) {
    /* The step follows the nearest structure: the surface, the rope, a sheet tip. */
    const toRope = Math.hypot(x, y - g.h) - g.rope;
    const toTip = g.q > g.p ? Math.min(Math.hypot(x, y - g.p), Math.hypot(x, y - g.q)) : Infinity;
    const h = Math.max(
      0.01,
      0.12 * Math.min(y + 0.1, Math.abs(toRope) + 0.05, toTip + 0.05, 1 + 0.25 * y),
    );
    dir(x, y, g, sign, d1);
    dir(x + 0.5 * h * d1[0], y + 0.5 * h * d1[1], g, sign, d2);
    dir(x + 0.5 * h * d2[0], y + 0.5 * h * d2[1], g, sign, d3);
    dir(x + h * d3[0], y + h * d3[1], g, sign, d4);
    const px = x;
    const py = y;
    x += (h / 6) * (d1[0] + 2 * d2[0] + 2 * d3[0] + d4[0]);
    y += (h / 6) * (d1[1] + 2 * d2[1] + 2 * d3[1] + d4[1]);
    if (y <= 0) {
      const t = py / (py - y);
      x = px + (x - px) * t;
      y = 0;
      put();
      outcome = "landed";
      break;
    }
    if (Math.hypot(x, y - g.h) < g.rope) {
      put();
      outcome = "rope";
      break;
    }
    if (Math.abs(x) > box || y > box) {
      put();
      outcome = "open";
      break;
    }
    put();
  }
  line.count = count;
  return outcome;
}

/**
 * The field lines at `s`: `levels` lines launched from the right-hand source at even angles,
 * each traced over to the other side, around the rope or out of the box, and a few rings of the
 * rope's own field. Fills `lines`; returns how many are in use.
 */
export function contours(s: number, levels: number, lines: PlaneLine[], geometry = geometryAt(s)) {
  const g = geometry;
  let used = 0;
  for (let k = 0; k < levels && used < lines.length; k++) {
    const angle = (Math.PI * (k + 0.5)) / levels;
    const x = g.lambda + LAUNCH * Math.cos(angle);
    const y = LAUNCH * Math.sin(angle);
    /* Away from the source. */
    planeFieldAt(x, y, g, b);
    const sign = b.bx * Math.cos(angle) + b.by * Math.sin(angle) >= 0 ? 1 : -1;
    const line = lines[used]!;
    const outcome = tracePlaneLine(x, y, g, sign, line);
    if (outcome === "stuck" && line.count < 3) continue;
    /* Its apex tells which side of the sheet it is on. */
    let apex = 0;
    for (let i = 0; i < line.count; i++) apex = Math.max(apex, line.points[2 * i + 1]!);
    line.kind =
      outcome === "open"
        ? "open"
        : outcome === "rope"
          ? "rope"
          : g.q > g.p && apex < g.p
            ? "postflare"
            : "arcade";
    used++;
  }
  /* The rope's own field: rings about its axis. */
  const rings = Math.min(3, lines.length - used);
  for (let k = 0; k < rings; k++) {
    const line = lines[used++]!;
    const radius = (g.rope * (k + 1)) / rings;
    const n = Math.min(48, line.points.length / 2);
    for (let i = 0; i < n; i++) {
      const a = (2 * Math.PI * i) / (n - 1);
      line.points[2 * i] = radius * Math.cos(a);
      line.points[2 * i + 1] = g.h + radius * Math.sin(a);
    }
    line.count = n;
    line.kind = "rope";
  }
  return used;
}

const ribbonProbe = blankPlaneLine();

/**
 * The separation of the flare ribbons, λ₀: where the newest post-flare loop, the line just under
 * the sheet's bottom, crosses the chromosphere's height on each side; 0 before reconnection.
 */
export function ribbonGapAt(g: Geometry) {
  if (g.q <= g.p || g.p <= RIBBON_HEIGHT) return 0;
  const y0 = g.p * 0.98;
  planeFieldAt(1e-3, y0, g, b);
  const sign = b.bx >= 0 ? 1 : -1;
  tracePlaneLine(1e-3, y0, g, sign, ribbonProbe);
  for (let i = 1; i < ribbonProbe.count; i++) {
    const y = ribbonProbe.points[2 * i + 1]!;
    if (y <= RIBBON_HEIGHT) {
      const yPrev = ribbonProbe.points[2 * (i - 1) + 1]!;
      const xPrev = ribbonProbe.points[2 * (i - 1)]!;
      const x = ribbonProbe.points[2 * i]!;
      const t = (yPrev - RIBBON_HEIGHT) / (yPrev - y || 1);
      return 2 * Math.abs(xPrev + (x - xPrev) * t);
    }
  }
  return 0;
}

/** What one moment of the eruption shows, in R☉ except where said. */
export type EruptionState = {
  s: number;
  ropeHeight: number;
  sheetBottom: number;
  sheetTop: number;
  reconnection: number;
  flareLight: number;
  /** Radians of arc on the surface. */
  ribbonGap: number;
  cmeFront: number;
  cmeSpread: number;
  geometry: Geometry;
};

export const blankEruptionState = (): EruptionState => ({
  s: 0,
  ropeHeight: 0,
  sheetBottom: 0,
  sheetTop: 0,
  reconnection: 0,
  flareLight: 0,
  ribbonGap: 0,
  cmeFront: 1,
  cmeSpread: 0,
  geometry: { lambda: 1, h: 1, rope: ROPE_RADIUS, p: 0, q: 0 },
});

/** The eruption at `s`, 0–1. */
export function eruptionAt(s: number, out: EruptionState = blankEruptionState()) {
  const t = clamp01(s);
  const g = geometryAt(t, out.geometry);
  out.s = t;
  out.ropeHeight = g.h * ERUPTION_SCALE_R;
  out.sheetBottom = g.p * ERUPTION_SCALE_R;
  out.sheetTop = g.q * ERUPTION_SCALE_R;
  out.reconnection = reconnectionAt(t);
  out.flareLight = flareLightAt(t);
  out.ribbonGap = ribbonGapAt(g) * ERUPTION_SCALE_R;
  const loose = smoothstep(ERUPTION_STAGES.rise, ERUPTION_STAGES.breakaway, t);
  out.cmeFront = loose > 0 ? 1 + (g.h + g.rope) * ERUPTION_SCALE_R : 1;
  out.cmeSpread = CME_SPREAD_RAD * loose;
  return out;
}

/** Lines one eruption frame carries, for a host's slots. */
export const ERUPTION_LINE_COUNT = ERUPTION_LINES;
