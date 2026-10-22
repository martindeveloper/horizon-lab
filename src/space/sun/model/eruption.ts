/**
 * One kinematic eruption: contours of a single evolving flux function, not independent
 * arcade and rope drawings. See reconnection.ts for the induction equation and limitations.
 * All lengths here are in the model's local unit, except the public EruptionState.
 */
import { clamp01, smoothstep } from "@horizon/toolkit/math";

import {
  CME_FINAL_HEIGHT_R,
  CME_SPREAD_RAD,
  ERUPTION_LINES,
  ERUPTION_SCALE_R,
  ERUPTION_STAGES,
  FLARE_LIGHT_DECAY_S01,
  RECONNECTION,
  ROPE_HEIGHT_AT_BREAKAWAY,
  STORAGE_LAMBDA,
  X_POINT_S,
} from "./parameters";
import { contourX, contourY, fluxAt, fluxTransferRateAt, transferredFluxAt } from "./reconnection";

export type Geometry = {
  s: number;
  lambda: number;
  h: number;
  rope: number;
  p: number;
  q: number;
  base: number;
  stretch: number;
};

/* Prescribed rise, not an acceleration calculated from the momentum equation. */
const U_BREAKAWAY =
  (ERUPTION_STAGES.rise - ERUPTION_STAGES.storage) / (1 - ERUPTION_STAGES.storage);
// Normalise the rise by the outer separatrix, so the CME FRONT, not its centre, reaches
// the catalogue's final radius. The lower arcade keeps its scale after storage.
const finalTop = contourY(-transferredFluxAt(1), 1, 2, 4);
const finalStretch = (finalTop - 1) ** 2;
const liftHeight = (y: number) =>
  y + RECONNECTION.lowCoronalLift * Math.tanh(y / RECONNECTION.lowCoronalScale);
function unliftHeight(y: number) {
  let lo = Math.max(0, y - RECONNECTION.lowCoronalLift);
  let hi = y;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (liftHeight(mid) < y) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
const finalRawHeight = unliftHeight((CME_FINAL_HEIGHT_R - 1) / ERUPTION_SCALE_R);
const FINAL_HEIGHT = (finalRawHeight - finalTop / 2) / finalStretch + 1;
const RISE_B =
  Math.log(((FINAL_HEIGHT - 1) / (ROPE_HEIGHT_AT_BREAKAWAY - 1)) * U_BREAKAWAY ** 2) /
  (1 - U_BREAKAWAY);
const RISE_A = (FINAL_HEIGHT - 1) * Math.exp(-RISE_B);
const storageLambdaAt = (s: number) =>
  STORAGE_LAMBDA[0] +
  (STORAGE_LAMBDA[1] - STORAGE_LAMBDA[0]) * smoothstep(0, ERUPTION_STAGES.storage, s);

export function ropeHeight(s: number) {
  const t = clamp01(s);
  const { storage } = ERUPTION_STAGES;
  if (t < storage) return 1 / storageLambdaAt(t);
  const u = (t - storage) / (1 - storage);
  return 1 + RISE_A * u * u * Math.exp(RISE_B * u);
}

/** Monotonic ideal deformation; the lower arcade scale is fixed during rise and reconnection. */
const rawHeight = (y: number, g: Geometry) => g.base * y + g.stretch * Math.max(0, y - 1) ** 2;
export const displayHeight = (y: number, g: Geometry) => liftHeight(rawHeight(y, g));
/** The same ideal expansion widens the island and its overlying field, leaving feet fixed. */
export const displayWidth = (y: number, g: Geometry) =>
  1 + 2 * Math.tan(CME_SPREAD_RAD) * g.stretch * Math.max(0, y - 1) ** 2;
export function referenceHeight(height: number, g: Geometry) {
  const y = unliftHeight(height);
  return y <= g.base || g.stretch === 0
    ? y / g.base
    : 1 + (2 * (y - g.base)) / (g.base + Math.sqrt(g.base ** 2 + 4 * g.stretch * (y - g.base)));
}

export function geometryAt(
  s: number,
  out: Geometry = { s: 0, lambda: 1, h: 1, rope: 0, p: 0, q: 0, base: 0.5, stretch: 0 },
) {
  const t = clamp01(s);
  out.s = t;
  out.lambda = storageLambdaAt(t);
  const height = ropeHeight(t);
  // Storage and rise both have zero velocity at their join. Freezing the base here
  // keeps the whole display map C1 in time, including when reconnection starts.
  out.base = Math.min(height, 1) / 2;
  out.stretch = height - 2 * out.base;
  out.h = displayHeight(2, out);
  out.p = t > X_POINT_S ? displayHeight(1 - RECONNECTION.diffusionHeight, out) : 0;
  out.q = t > X_POINT_S ? displayHeight(1 + RECONNECTION.diffusionHeight, out) : 0;
  const top = contourY(-transferredFluxAt(t), t, 2, 4);
  out.rope = displayHeight(top, out) - out.h;
  return out;
}

export type PlaneField = { bx: number; by: number };
/** The field after the common ideal coordinate mapping, from A composed with its inverse. */
export function planeFieldAt(
  x: number,
  y: number,
  g: Geometry,
  out: PlaneField = { bx: 0, by: 0 },
) {
  const refY = referenceHeight(y, g);
  const width = displayWidth(refY, g);
  const refX = x / (g.lambda * width);
  const field = fluxAt(refX, refY, g.s);
  const widthDerivative = 4 * Math.tan(CME_SPREAD_RAD) * g.stretch * Math.max(0, refY - 1);
  const tanh = Math.tanh(rawHeight(refY, g) / RECONNECTION.lowCoronalScale);
  const liftDerivative =
    1 + (RECONNECTION.lowCoronalLift / RECONNECTION.lowCoronalScale) * (1 - tanh * tanh);
  out.bx =
    (field.ay - (field.ax * refX * widthDerivative) / width) /
    ((g.base + 2 * g.stretch * Math.max(0, refY - 1)) * liftDerivative);
  out.by = -field.ax / (g.lambda * width);
  return out;
}

const PEAK_RATE = fluxTransferRateAt(X_POINT_S + (1 - X_POINT_S) / 4);
export const reconnectionAt = (s: number) => fluxTransferRateAt(s) / PEAK_RATE;
/* A delayed emission proxy driven by the SAME flux-transfer rate; not an energy solution. */
const SAMPLES = 400;
const LIGHT = new Float64Array(SAMPLES + 1);
{
  let light = 0;
  let peak = 0;
  for (let i = 0; i <= SAMPLES; i++) {
    light =
      light * Math.exp(-1 / (SAMPLES * FLARE_LIGHT_DECAY_S01)) +
      reconnectionAt(i / SAMPLES) / SAMPLES;
    LIGHT[i] = light;
    peak = Math.max(peak, light);
  }
  for (let i = 0; i <= SAMPLES; i++) LIGHT[i] = LIGHT[i]! / peak;
}
export function flareLightAt(s: number) {
  const u = clamp01(s) * SAMPLES;
  const i = Math.min(SAMPLES - 1, Math.floor(u));
  return LIGHT[i]! + (LIGHT[i + 1]! - LIGHT[i]!) * (u - i);
}

export type PlaneLine = {
  points: Float32Array;
  count: number;
  kind: "arcade" | "postflare" | "rope";
  strand: number;
  /** A fixed flux label: both products inherit the incoming contour's value. */
  flux: number;
};
export const PLANE_LINE_POINTS = 160;
export const blankPlaneLine = (): PlaneLine => ({
  points: new Float32Array(2 * PLANE_LINE_POINTS),
  count: 0,
  kind: "arcade",
  strand: 0,
  flux: 0,
});

/** A COMPLETE level-set component: two surface feet, or a closed upper magnetic island. */
function component(
  line: PlaneLine,
  a: number,
  low: number,
  high: number,
  g: Geometry,
  closed: boolean,
) {
  const n = line.points.length / 2;
  line.count = n;
  line.flux = a;
  for (let i = 0; i < n; i++) {
    const phase = (2 * Math.PI * i) / (n - 1);
    const y = low + ((high - low) * (1 - Math.cos(phase))) / 2;
    const x = contourX(y, a, g.s) * (i <= (n - 1) / 2 ? 1 : -1);
    line.points[2 * i] = x * g.lambda * displayWidth(y, g);
    line.points[2 * i + 1] = displayHeight(y, g);
  }
  if (closed) {
    line.points[0] = 0;
    line.points[2 * (n - 1)] = 0;
    line.points[2 * (n - 1) + 1] = line.points[1]!;
  }
}

/**
 * Fixed flux labels converge on the X-point. Each changes connectivity there into TWO
 * components with the same A: an ascending island and a contracting surface-connected loop.
 * Their coordinates are solved from A=a, never truncated or joined across a missing trace.
 */
export function contours(s: number, capacity: number, lines: PlaneLine[], g = geometryAt(s)) {
  const limit = Math.min(capacity, lines.length);
  const cores = Math.min(RECONNECTION.coreLines, Math.max(0, limit - 2));
  const incoming = Math.floor((limit - cores) / 2);
  const nullFlux = -transferredFluxAt(s);
  let used = 0;
  for (let i = 0; i < incoming; i++) {
    const a = (RECONNECTION.outerFlux * (i + 0.5)) / incoming;
    const top = contourY(a, s, 2, 4);
    const reconnected = a > nullFlux;
    const line = lines[used++]!;
    line.strand = i;
    line.kind = reconnected ? "postflare" : "arcade";
    component(line, a, 0, reconnected ? contourY(a, s, 0, 1) : top, g, false);
    if (reconnected) {
      const upper = lines[used++]!;
      upper.strand = i;
      upper.kind = "rope";
      component(upper, a, contourY(a, s, 1, 2), top, g, true);
    }
  }
  // These are contours of the same field inside the pre-existing island, not extra rope art.
  for (let i = 0; i < cores; i++) {
    const a = (i + 1) / (6 * (cores + 1));
    const line = lines[used++]!;
    line.strand = incoming + i;
    line.kind = "rope";
    component(line, a, contourY(a, s, 1, 2), contourY(a, s, 2, 4), g, true);
  }
  return used;
}

/** The separatrix footprints separate as flux transfers; their surface flux stays fixed. */
export function ribbonGapAt(g: Geometry) {
  return g.s > X_POINT_S ? 2 * contourX(0, -transferredFluxAt(g.s), g.s) * g.lambda : 0;
}

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
  /** Visibility of the illustrative CME envelope, separate from its geometric radius. */
  cmePresence: number;
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
  cmePresence: 0,
  geometry: geometryAt(0),
});

export function eruptionAt(s: number, out: EruptionState = blankEruptionState()) {
  const t = clamp01(s);
  const g = geometryAt(t, out.geometry);
  out.s = t;
  out.ropeHeight = g.h * ERUPTION_SCALE_R;
  out.sheetBottom = g.p * ERUPTION_SCALE_R;
  out.sheetTop = g.q * ERUPTION_SCALE_R;
  out.reconnection = reconnectionAt(t);
  out.flareLight = flareLightAt(t);
  out.ribbonGap = 2 * Math.atan((ribbonGapAt(g) * ERUPTION_SCALE_R) / 2);
  const loose = smoothstep(ERUPTION_STAGES.rise, ERUPTION_STAGES.breakaway, t);
  out.cmeFront = 1 + (g.h + g.rope) * ERUPTION_SCALE_R;
  out.cmeSpread = CME_SPREAD_RAD * loose;
  out.cmePresence = loose;
  return out;
}

export const ERUPTION_LINE_COUNT = ERUPTION_LINES;
