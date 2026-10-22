/**
 * Three cascaded smoothing stages produce an Erlang-shaped velocity curve.
 * Retargeting mid-move preserves continuity, including when moving to a smaller body.
 */
import { GLIDE_SECONDS, GLIDE_SECONDS_PER_DOUBLING } from "../parameters";

/** The three stages' places on the ladder; the camera is at the last. */
export type Glide = [number, number, number];

/**
 * A move from rest of three stages has covered all but 2 % of its way when t/τ reaches this
 * root of e^(−x) (1 + x + x²/2) = 0.02.
 */
const SETTLES_AT = 7.5;

/** How long a move of `span` rungs takes: longer for a longer one, growing with its doubling. */
export function glideSeconds(span: number) {
  return GLIDE_SECONDS + GLIDE_SECONDS_PER_DOUBLING * Math.log2(Math.max(1, Math.abs(span)));
}

export const glideAt = (place: number): Glide => [place, place, place];

/**
 * A glide already moving at `speed` rungs a second, as a hand lets go: in steady motion each
 * stage leads the next by τ times the speed.
 */
export function glideFrom(place: number, speed: number, seconds: number): Glide {
  const lead = (speed * seconds) / SETTLES_AT;
  return [place + 2 * lead, place + lead, place];
}

/**
 * The glide `dt` seconds on, heading for `target` on a move of `seconds`: the chain's exact
 * solution over the step, so the same at any frame rate. With each stage's distance from the
 * target eᵢ and s = dt/τ: e₁ ← e₁ e⁻ˢ, e₂ ← (e₂ + e₁ s) e⁻ˢ, e₃ ← (e₃ + e₂ s + e₁ s²/2) e⁻ˢ.
 */
export function glideTowards(glide: Glide, target: number, dt: number, seconds: number): Glide {
  const s = dt / Math.max(seconds / SETTLES_AT, 1e-4);
  const fade = Math.exp(-s);
  const [a, b, c] = [glide[0] - target, glide[1] - target, glide[2] - target];
  return [
    target + a * fade,
    target + (b + a * s) * fade,
    target + (c + b * s + (a * s * s) / 2) * fade,
  ];
}

export const glideRests = (glide: Glide, target: number) =>
  glide.every((stage) => Math.abs(stage - target) < 1e-4);
