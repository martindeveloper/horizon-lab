import { BENCH_RANGE, type Bench } from "./scenes";

/**
 * How the guide moves between steps instead of jumping: the wavelength window zooms, and the
 * lamp, the gas, its amount, a main-sequence star's temperature and the source's velocity glide
 * to their new values, so the spectrum visibly changes on its way. Discrete settings (the view,
 * the elements, Earth's air) switch at the start; the selected line opens on landing.
 */
export type GuidePose = {
  range: readonly [number, number];
  velocity: number;
  /** K; 0 when the lamp is off. */
  lamp: number;
  gas: number;
  /** log₁₀ N. */
  column: number;
  sequenceTemperature: number;
};

type PoseSource = {
  range: readonly [number, number];
  velocity: number;
  bench: Bench;
  sequenceTemperature: number;
};

export const poseOf = (s: PoseSource): GuidePose => ({
  range: s.range,
  velocity: s.velocity,
  lamp: s.bench.lamp,
  gas: s.bench.gas,
  column: s.bench.column,
  sequenceTemperature: s.sequenceTemperature,
});

/** Ease in and out (cubic): the motion starts and lands gently. */
export function ease(t: number) {
  if (t <= 0) {
    return 0;
  }
  if (t >= 1) {
    return 1;
  }
  if (t < 0.5) {
    return 4 * t ** 3;
  }
  return 1 - (-2 * t + 2) ** 3 / 2;
}

const linear = (a: number, b: number, t: number) => a + (b - a) * t;
const geometric = (a: number, b: number, t: number) => a * (b / a) ** t;

/**
 * A lamp switched off glides down to its dimmest setting and goes out on landing; one switched
 * on starts there. On the way it passes the gas's temperature, so the lines turn over from dark
 * to bright, as Kirchhoff's laws say they must.
 */
function lampBetween(a: number, b: number, t: number) {
  if (a <= 0 && b <= 0) return 0;
  if (t >= 1) return b;
  const dimmest = BENCH_RANGE.lamp[0];
  return geometric(a > 0 ? a : dimmest, b > 0 ? b : dimmest, t);
}

/** The pose a fraction `t` (0–1, already eased) of the way from `a` to `b`. */
export function poseBetween(a: GuidePose, b: GuidePose, t: number): GuidePose {
  /* The window zooms about a gliding centre, its width changing by a constant factor per frame. */
  const [a0, a1] = a.range;
  const [b0, b1] = b.range;
  const centre = linear((a0 + a1) / 2, (b0 + b1) / 2, t);
  const span = geometric(a1 - a0, b1 - b0, t);
  return {
    range: t >= 1 ? b.range : [centre - span / 2, centre + span / 2],
    velocity: linear(a.velocity, b.velocity, t),
    lamp: lampBetween(a.lamp, b.lamp, t),
    gas: geometric(a.gas, b.gas, t),
    column: linear(a.column, b.column, t),
    sequenceTemperature: geometric(a.sequenceTemperature, b.sequenceTemperature, t),
  };
}

/** How long a move takes, ms: longer for a big zoom, short when little changes. */
export function moveDuration(a: GuidePose, b: GuidePose) {
  const zoom = Math.abs(Math.log((b.range[1] - b.range[0]) / (a.range[1] - a.range[0])));
  const changed =
    zoom > 0.01 ||
    Math.abs(a.range[0] - b.range[0]) > 0.5 ||
    Math.abs(a.velocity - b.velocity) > 0.5 ||
    a.lamp !== b.lamp ||
    Math.abs(Math.log(a.gas / b.gas)) > 0.01 ||
    Math.abs(a.column - b.column) > 0.05 ||
    Math.abs(Math.log(a.sequenceTemperature / b.sequenceTemperature)) > 0.01;
  return changed ? 1100 + Math.min(700, zoom * 250) : 0;
}
