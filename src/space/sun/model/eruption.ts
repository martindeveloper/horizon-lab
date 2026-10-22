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
  /** The line-tied lower arcade's height scale, kept from storage on. */
  base: number;
  /** The current sheet's added length above the X-point. */
  sheet: number;
  /** The ejected island's added vertical scale, and its added width. */
  body: number;
  widen: number;
};

/*
 * The common ideal height map: base·y + sheet·σ(y) + body·ρ(y). Below the X-point the arcade
 * stays line-tied at its storage scale. Over the diffusion region's upper half σ steps from 0
 * to 1: the field between the X-point and the rope draws out into a long, thin current sheet.
 * Over the next such span ρ turns from flat to a unit slope and the width steps up with it,
 * so the rope above lifts away as one body, scaled uniformly.
 */
const SHEET_REACH = RECONNECTION.diffusionHeight;
const BODY_FOOT = 1 + SHEET_REACH;
const step = (y: number, from: number) => smoothstep(from, from + SHEET_REACH, y);
function stepSlope(y: number, from: number) {
  const t = (y - from) / SHEET_REACH;
  return t > 0 && t < 1 ? (6 * t * (1 - t)) / SHEET_REACH : 0;
}
/** C1: flat below `from`, a unit slope one span above it. */
function ramp(y: number, from: number) {
  if (y <= from) return 0;
  return y < from + SHEET_REACH ? (y - from) ** 2 / (2 * SHEET_REACH) : y - from - SHEET_REACH / 2;
}
const rampSlope = (y: number, from: number) => clamp01((y - from) / SHEET_REACH);

const rawHeight = (y: number, g: Geometry) =>
  g.base * y + g.sheet * step(y, 1) + g.body * ramp(y, BODY_FOOT);
const rawSlope = (y: number, g: Geometry) =>
  g.base + g.sheet * stepSlope(y, 1) + g.body * rampSlope(y, BODY_FOOT);
/** How far the rope's centre sits up the body ramp: raw(2) = 2·base + sheet + body·this. */
const CENTRE_RAMP = ramp(2, BODY_FOOT);

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

export const displayHeight = (y: number, g: Geometry) => liftHeight(rawHeight(y, g));
/** The body widens with the step that lifts it; the arcade and the sheet keep their width. */
export const displayWidth = (y: number, g: Geometry) => 1 + g.widen * step(y, BODY_FOOT);
export function referenceHeight(height: number, g: Geometry) {
  const raw = unliftHeight(height);
  let lo = 0;
  let hi = raw / g.base;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (rawHeight(mid, g) < raw) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/* Prescribed rise, not an acceleration calculated from the momentum equation. */
const U_BREAKAWAY =
  (ERUPTION_STAGES.rise - ERUPTION_STAGES.storage) / (1 - ERUPTION_STAGES.storage);
const ARCADE_BASE = 1 / (2 * STORAGE_LAMBDA[1]);

/*
 * Calibrate the ejected body once, from the catalogued front and half-width. At the end the
 * outer separatrix's top reaches CME_FINAL_HEIGHT_R, the island subtends CME_SPREAD_RAD from
 * the Sun's centre, and it is as wide as the span from the sheet's top to the front: a round
 * rope, as coronagraph flux-rope fits model it. The sheet's length follows; it is not chosen.
 * The plane's x is an arc on the sphere (eruptionPoint), so a point subtends atan(x) from the
 * axis and lies r·sin of that from it.
 */
const FINAL_FLUX = -transferredFluxAt(1);
const finalTop = contourY(FINAL_FLUX, 1, 2, 4);
const finalFront = (CME_FINAL_HEIGHT_R - 1) / ERUPTION_SCALE_R;
const OUTLINE = Array.from({ length: 64 }, (_, i) => {
  const y = BODY_FOOT + ((finalTop - BODY_FOOT) * i) / 63;
  return [y, contourX(y, FINAL_FLUX, 1)] as const;
});
function finalBody(share: number) {
  // raw(2) = 2·base + rise and raw(top) = base·top + rise·(1 + share·(top − 2)).
  const rise = (unliftHeight(finalFront) - ARCADE_BASE * finalTop) / (1 + share * (finalTop - 2));
  const g: Geometry = {
    s: 1,
    lambda: STORAGE_LAMBDA[1],
    h: 0,
    rope: 0,
    p: 0,
    q: 0,
    base: ARCADE_BASE,
    sheet: rise * (1 - share * CENTRE_RAMP),
    body: share * rise,
    widen: 0,
  };
  const arc = (y: number, x: number) =>
    Math.atan(ERUPTION_SCALE_R * g.lambda * displayWidth(y, g) * x);
  const lateral = () =>
    Math.max(
      ...OUTLINE.map(
        ([y, x]) => (1 + ERUPTION_SCALE_R * displayHeight(y, g)) * Math.sin(arc(y, x)),
      ),
    );
  const radius = (ERUPTION_SCALE_R * (finalFront - displayHeight(BODY_FOOT, g))) / 2;
  let lo = 0;
  let hi = 1e3;
  for (let i = 0; i < 60; i++) {
    g.widen = (lo + hi) / 2;
    if (lateral() < radius) lo = g.widen;
    else hi = g.widen;
  }
  return {
    rise,
    widen: g.widen / g.body,
    angle: Math.max(...OUTLINE.map(([y, x]) => arc(y, x))),
  };
}
/** The share of the rise that scales the body rather than lengthening the sheet. */
const BODY_SHARE = (() => {
  let lo = 0;
  let hi = 1 / CENTRE_RAMP;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (finalBody(mid).angle < CME_SPREAD_RAD) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
})();
const { rise: FINAL_RISE, widen: BODY_WIDEN } = finalBody(BODY_SHARE);
const FINAL_HEIGHT = 2 * ARCADE_BASE + FINAL_RISE;
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

export function geometryAt(
  s: number,
  out: Geometry = {
    s: 0,
    lambda: 1,
    h: 1,
    rope: 0,
    p: 0,
    q: 0,
    base: 0.5,
    sheet: 0,
    body: 0,
    widen: 0,
  },
) {
  const t = clamp01(s);
  out.s = t;
  out.lambda = storageLambdaAt(t);
  const height = ropeHeight(t);
  // Storage and rise both have zero velocity at their join. Freezing the base here
  // keeps the whole display map C1 in time, including when reconnection starts.
  out.base = Math.min(height, 1) / 2;
  const rise = height - 2 * out.base;
  out.body = BODY_SHARE * rise;
  out.sheet = rise - out.body * CENTRE_RAMP;
  out.widen = BODY_WIDEN * out.body;
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
  const widthDerivative = g.widen * stepSlope(refY, BODY_FOOT);
  const tanh = Math.tanh(rawHeight(refY, g) / RECONNECTION.lowCoronalScale);
  const liftDerivative =
    1 + (RECONNECTION.lowCoronalLift / RECONNECTION.lowCoronalScale) * (1 - tanh * tanh);
  out.bx =
    (field.ay - (field.ax * refX * widthDerivative) / width) / (rawSlope(refY, g) * liftDerivative);
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
