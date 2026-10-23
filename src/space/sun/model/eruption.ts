/**
 * One kinematic eruption: contours of a single evolving flux function, not independent
 * arcade and rope drawings. See reconnection.ts for the induction equation and limitations.
 * All lengths here are in the model's local unit, except the public EruptionState.
 */
import { clamp01, smootherstep, smoothstep } from "@horizon/toolkit/math";

import {
  CME_FINAL_HEIGHT_R,
  CME_SPREAD_RAD,
  ERUPTION_LINES,
  ERUPTION_SCALE_R,
  ERUPTION_SECONDS,
  ERUPTION_STAGES,
  FLARE_LIGHT_DECAY_S01,
  RADIUS_M,
  RECONNECTION,
  SLOW_RISE_KM_S,
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
  /** The sheet's top in the reference plane, where the rope's body begins. */
  foot: number;
  /** The current sheet's added length above the X-point. */
  sheet: number;
  /** The ejected island's added vertical scale, and its added width. */
  body: number;
  widen: number;
};

/*
 * The common ideal height map: base·y + sheet·σ(y) + body·ρ(y). Below the X-point the arcade
 * stays line-tied at its storage scale. From the X-point to the sheet's foot σ steps from 0 to
 * 1: the field there draws out into a long, thin current sheet. Above it ρ turns from flat to
 * a unit slope, so the rope lifts away as one body, and its width grows over its lower half.
 * While flux transfers the foot is the diffusion region's top; as the transfer completes the
 * stretched field relaxes into the rope and the foot sinks toward the X-point, so the last
 * reconnected loops leave the sheet: the rope breaks free of the flare below it.
 */
const BODY_RAMP = RECONNECTION.diffusionHeight;
const sheetFootAt = (s: number) =>
  1 +
  RECONNECTION.relaxedSheet +
  (RECONNECTION.diffusionHeight - RECONNECTION.relaxedSheet) *
    (1 - transferredFluxAt(s) / RECONNECTION.transferredFlux);
function stepSlope(y: number, from: number, to: number) {
  const t = (y - from) / (to - from);
  return t > 0 && t < 1 ? (6 * t * (1 - t)) / (to - from) : 0;
}
/** C1: flat below `from`, a unit slope one ramp above it. */
function ramp(y: number, from: number) {
  if (y <= from) return 0;
  return y < from + BODY_RAMP ? (y - from) ** 2 / (2 * BODY_RAMP) : y - from - BODY_RAMP / 2;
}
const rampSlope = (y: number, from: number) => clamp01((y - from) / BODY_RAMP);

const rawHeight = (y: number, g: Geometry) =>
  g.base * y + g.sheet * smoothstep(1, g.foot, y) + g.body * ramp(y, g.foot);
const rawSlope = (y: number, g: Geometry) =>
  g.base + g.sheet * stepSlope(y, 1, g.foot) + g.body * rampSlope(y, g.foot);

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
/** The body widens up to the rope's centre; the arcade and the sheet keep their width. C2, so
 * the mapped field stays C1 through the rope's neck. */
const widthStep = (y: number, g: Geometry) => smootherstep((y - g.foot) / (2 - g.foot));
function widthStepSlope(y: number, g: Geometry) {
  const t = (y - g.foot) / (2 - g.foot);
  return t > 0 && t < 1 ? (30 * t * t * (1 - t) ** 2) / (2 - g.foot) : 0;
}
export const displayWidth = (y: number, g: Geometry) => 1 + g.widen * widthStep(y, g);
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
const FINAL_FOOT = sheetFootAt(1);
const finalTop = contourY(FINAL_FLUX, 1, 2, 4);
const finalFront = (CME_FINAL_HEIGHT_R - 1) / ERUPTION_SCALE_R;
const OUTLINE = Array.from({ length: 64 }, (_, i) => {
  const y = FINAL_FOOT + ((finalTop - FINAL_FOOT) * i) / 63;
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
    foot: FINAL_FOOT,
    sheet: rise * (1 - share * ramp(2, FINAL_FOOT)),
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
  const radius = (ERUPTION_SCALE_R * (finalFront - displayHeight(FINAL_FOOT, g))) / 2;
  let lo = 0;
  let hi = 1e3;
  for (let i = 0; i < 60; i++) {
    g.widen = (lo + hi) / 2;
    if (lateral() < radius) lo = g.widen;
    else hi = g.widen;
  }
  return {
    widen: g.widen / g.body,
    angle: Math.max(...OUTLINE.map(([y, x]) => arc(y, x))),
  };
}
/** The share of the rise that scales the body rather than lengthening the sheet. */
const BODY_SHARE = (() => {
  let lo = 0;
  let hi = 1 / ramp(2, FINAL_FOOT);
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (finalBody(mid).angle < CME_SPREAD_RAD) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
})();
const { widen: BODY_WIDEN } = finalBody(BODY_SHARE);
const storageLambdaAt = (s: number) =>
  STORAGE_LAMBDA[0] +
  (STORAGE_LAMBDA[1] - STORAGE_LAMBDA[0]) * smoothstep(0, ERUPTION_STAGES.storage, s);

/** The rope's centre in the reference plane's unit: under 1 while stored, 1 + its rise after. */
export function ropeHeight(s: number) {
  const g = geometryAt(s);
  return 2 * g.base + g.sheet + g.body * ramp(2, g.foot);
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
    foot: sheetFootAt(0),
    sheet: 0,
    body: 0,
    widen: 0,
  },
) {
  const t = clamp01(s);
  out.s = t;
  out.lambda = storageLambdaAt(t);
  // Storage ends at rest and the slow rise starts from it. Freezing the base here keeps the
  // whole display map C1 in time, including when reconnection starts.
  out.base = 1 / (2 * out.lambda);
  out.foot = sheetFootAt(t);
  const top = contourY(-transferredFluxAt(t), t, 2, 4);
  // The rise the front's kinematics ask of the map: raw(top) = base·top + rise·k.
  const k = 1 + BODY_SHARE * (ramp(top, out.foot) - ramp(2, out.foot));
  const rise =
    t <= ERUPTION_STAGES.storage
      ? 0
      : Math.max(0, (unliftHeight((frontAt(t) - 1) / ERUPTION_SCALE_R) - out.base * top) / k);
  out.body = BODY_SHARE * rise;
  out.sheet = rise - out.body * ramp(2, out.foot);
  out.widen = BODY_WIDEN * out.body;
  out.h = displayHeight(2, out);
  out.p = t > X_POINT_S ? displayHeight(1 - RECONNECTION.diffusionHeight, out) : 0;
  out.q = t > X_POINT_S ? displayHeight(out.foot, out) : 0;
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
  const widthDerivative = g.widen * widthStepSlope(refY, g);
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

/*
 * The front's prescribed kinematics follow the three observed phases of flare-associated CMEs
 * (Zhang et al. 2001, ApJ 559, 452; Bein et al. 2012, ApJ 755, 44): a slow rise before the
 * flare, then an acceleration proportional to the reconnection rate, the flare's hard X-rays
 * (Temmer et al. 2008, ApJ 673, L95), so it peaks with the energy release and ends as the soft
 * X-rays fade, then coasting. Its scale puts the front at CME_FINAL_HEIGHT_R at the end. The
 * force is prescribed, not solved from the momentum equation.
 */
const TOP_AT_REST = contourY(0, 0, 2, 4);
/** The stored arcade's separatrix top, R from the centre, at a storage height scale. */
const storedFront = (base: number) => 1 + ERUPTION_SCALE_R * liftHeight(base * TOP_AT_REST);
const STORED_FRONT = storedFront(ARCADE_BASE);
/** The slow rise in radii per unit of the timeline, and the stretch it has to itself. */
const SLOW_RISE = (SLOW_RISE_KM_S * 1e3 * ERUPTION_SECONDS) / RADIUS_M;
const SLOW_SPAN = X_POINT_S - ERUPTION_STAGES.storage;
function slowRiseAt(s: number) {
  if (s >= X_POINT_S) return SLOW_RISE * (SLOW_SPAN / 2 + s - X_POINT_S);
  const t = clamp01((s - ERUPTION_STAGES.storage) / SLOW_SPAN);
  // The integral of smoothstep: the speed eases in from the storage's rest.
  return SLOW_RISE * SLOW_SPAN * t * t * t * (1 - t / 2);
}
/** The speed and displacement a unit acceleration ∝ the reconnection rate drives, tabulated. */
const DRIVEN_SAMPLES = 600;
const DRIVEN_STEP = (1 - X_POINT_S) / DRIVEN_SAMPLES;
const DRIVEN_SPEED = new Float64Array(DRIVEN_SAMPLES + 1);
const DRIVEN_RISE = new Float64Array(DRIVEN_SAMPLES + 1);
for (let i = 1; i <= DRIVEN_SAMPLES; i++) {
  const before = reconnectionAt(X_POINT_S + (i - 1) * DRIVEN_STEP);
  const after = reconnectionAt(X_POINT_S + i * DRIVEN_STEP);
  DRIVEN_SPEED[i] = DRIVEN_SPEED[i - 1]! + ((before + after) / 2) * DRIVEN_STEP;
  DRIVEN_RISE[i] =
    DRIVEN_RISE[i - 1]! + ((DRIVEN_SPEED[i - 1]! + DRIVEN_SPEED[i]!) / 2) * DRIVEN_STEP;
}
/** Quadratic within a sample, so the speed stays continuous across it. */
function drivenRiseAt(s: number) {
  const u = clamp01((s - X_POINT_S) / (1 - X_POINT_S)) * DRIVEN_SAMPLES;
  const i = Math.min(DRIVEN_SAMPLES - 1, Math.floor(u));
  const tau = (u - i) * DRIVEN_STEP;
  const speed = DRIVEN_SPEED[i]!;
  const gain = DRIVEN_SPEED[i + 1]! - speed;
  return DRIVEN_RISE[i]! + speed * tau + (gain * tau * tau) / (2 * DRIVEN_STEP);
}
const DRIVEN_SCALE =
  (CME_FINAL_HEIGHT_R - STORED_FRONT - slowRiseAt(1)) / DRIVEN_RISE[DRIVEN_SAMPLES]!;

/** The ejection's front, R from the centre, on the timeline. */
export function frontAt(s: number) {
  const t = clamp01(s);
  if (t < ERUPTION_STAGES.storage) return storedFront(1 / (2 * storageLambdaAt(t)));
  return STORED_FRONT + slowRiseAt(t) + DRIVEN_SCALE * drivenRiseAt(t);
}
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
  // The heights run up one side and back down the other, so each solve serves a point and
  // its mirror; each starts from its neighbour's root.
  let x = 1;
  for (let i = 0; i <= (n - 1) / 2; i++) {
    const phase = (2 * Math.PI * i) / (n - 1);
    const y = low + ((high - low) * (1 - Math.cos(phase))) / 2;
    const root = contourX(y, a, g.s, x);
    if (root > 0) x = root;
    const across = root * g.lambda * displayWidth(y, g);
    const height = displayHeight(y, g);
    const mirror = n - 1 - i;
    line.points[2 * i] = across;
    line.points[2 * i + 1] = height;
    if (mirror === i) continue;
    line.points[2 * mirror] = -across;
    line.points[2 * mirror + 1] = height;
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
