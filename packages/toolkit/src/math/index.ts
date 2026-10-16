/** Small scalar operations. No React, DOM or rendering dependencies. */
export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
/** Clamp to [0, 1]. */
export function clamp01(value: number) {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}
export function lerp(from: number, to: number, t: number) {
  return from + (to - from) * t;
}
/** Quintic easing with zero first and second derivatives at the endpoints. */
export function smootherstep(t: number) {
  const x = clamp(t, 0, 1);
  return x * x * x * (x * (x * 6 - 15) + 10);
}
/** GLSL `smoothstep`: cubic Hermite from edge0 to edge1; edge0 > edge1 runs it downhill. */
export function smoothstep(edge0: number, edge1: number, x: number) {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}
/** Wrap into [0, period), e.g. degrees with 360 or radians with 2π. */
export function wrap(value: number, period: number) {
  return ((value % period) + period) % period;
}
/** Wrap into [−period/2, period/2): the shortest signed angle difference. */
export function wrapSigned(value: number, period: number) {
  return wrap(value + period / 2, period) - period / 2;
}
function checkLogRange(min: number, max: number) {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min <= 0 || max <= min)
    throw new RangeError("Logarithmic bounds must be finite and 0 < min < max");
}
export function toLogFraction(value: number, min: number, max: number) {
  checkLogRange(min, max);
  return Math.log(clamp(value, min, max) / min) / Math.log(max / min);
}
export function fromLogFraction(t: number, min: number, max: number) {
  checkLogRange(min, max);
  return min * (max / min) ** clamp(t, 0, 1);
}

export { lcg, mulberry32 } from "./random";
export { fbm3, valueNoise2, valueNoise3 } from "./noise";
