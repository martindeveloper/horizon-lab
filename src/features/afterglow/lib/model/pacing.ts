/**
 * The clock's tempo: where the Sun's look changes faster than the eye can follow, playback
 * slows. The chapters give each stretch of the life its seconds; inside them a few moments
 * still rush (the climb's last rise, the helium flash's collapse, the crossing to the nebula's
 * star, the dwarf's last fade), so the playhead's speed along the track is the chapters' pace
 * times a tempo, 1 where the Sun changes slowly and down to `TEMPO_FLOOR` where its look would
 * change by more than `CHANGE_PER_S` a second. The tempo eases in before a rush and comes back
 * up within its last moments (the per-step limit holds the Sun there), so a calm stretch after
 * a rush plays at once at its own pace rather than holding the Sun still; the timeline draws it
 * as the stretches where time slows. A rush
 * briefer than the table resolves (the last thermal pulse: thirty thousand years of a chapter
 * of a hundred million) is held to the same limit step by step, so no frame ever jumps.
 */
import { clamp, lerp } from "@horizon/toolkit/math";

import { TRACK_CELLS, ageToSlider, chapterOf, sliderToAge } from "./chapters";
import { DAY_GAMMA } from "./parameters";
import { sunAt, type SunState } from "./sun";
import { END_AGE } from "./track";

/** The most the Sun's look (`lookChange`) may change in a real second at the pace of 1. */
export const CHANGE_PER_S = 1.2;

/**
 * How much the Sun's look changes from one state to another, in logs: its size, its colour
 * (the temperature) and its brightness as the display shows it (the luminosity to the display's
 * root, `DAY_GAMMA`).
 */
export const lookChange = (a: SunState, b: SunState) =>
  Math.abs(Math.log(b.radius / a.radius)) +
  Math.abs(Math.log(b.teff / a.teff)) +
  DAY_GAMMA * Math.abs(Math.log(b.luminosity / a.luminosity));
/** The slowest the tempo goes, so nothing stops dead. */
export const TEMPO_FLOOR = 0.1;
/** How far the tempo eases into a rush, and back up within its end, as a share of the track. */
const EASE_SHARE = 0.012;
/** Samples along the track the tempo is tabulated at. */
const SAMPLES = 1800;

/** The tempo at each sample: the change a sample holds against what a second may hold, then widened and smoothed. */
const TEMPO: Float64Array = (() => {
  const raw = new Float64Array(SAMPLES + 1);
  let before = sunAt(sliderToAge(0));
  for (let i = 1; i <= SAMPLES; i += 1) {
    const sun = sunAt(sliderToAge(i / SAMPLES));
    const change = lookChange(before, sun);
    /* A sample lasts TRACK_CELLS / SAMPLES seconds at full tempo. */
    const perSecond = (change * SAMPLES) / TRACK_CELLS;
    raw[i] = clamp(CHANGE_PER_S / Math.max(perSecond, 1e-12), TEMPO_FLOOR, 1);
    before = sun;
  }
  raw[0] = raw[1]!;
  /*
   * Each rush widened by the ease ahead of it (the slowest tempo coming up), then smoothed over
   * the same reach ahead: it eases in before the rush and back up inside its end, never after.
   */
  const reach = Math.max(1, Math.round(EASE_SHARE * SAMPLES));
  const widened = raw.map((_, i) => {
    let least = 1;
    for (let j = i; j <= Math.min(SAMPLES, i + reach); j += 1) least = Math.min(least, raw[j]!);
    return least;
  });
  return widened.map((_, i) => {
    let sum = 0;
    let count = 0;
    for (let j = i; j <= Math.min(SAMPLES, i + reach); j += 1) {
      sum += Math.log(widened[j]!);
      count += 1;
    }
    return Math.exp(sum / count);
  });
})();

/** The tempo at a place along the track, 0–1: 1 at the chapters' pace, down to the floor through a rush. */
export function tempoAt(u: number) {
  const x = clamp(u, 0, 1) * SAMPLES;
  const i = Math.min(SAMPLES - 1, Math.floor(x));
  return lerp(TEMPO[i]!, TEMPO[i + 1]!, x - i);
}

/** How much a tempo slows the clock, 0 (none) to 1 (the floor): what the timeline's glow shows. */
export const hushOf = (tempo: number) => clamp(Math.log(tempo) / Math.log(TEMPO_FLOOR), 0, 1);

/** The slowed stretches along the track, as stops for the timeline: where each falls and how much it slows. */
export const TEMPO_STOPS: readonly { at: number; hush: number }[] = Array.from(
  { length: 241 },
  (_, k) => {
    const at = k / 240;
    return { at, hush: hushOf(tempoAt(at)) };
  },
);

/** Real seconds the whole life plays at the pace of 1, the tempo included. */
export const LIFE_SECONDS = (() => {
  let seconds = 0;
  for (let i = 0; i < SAMPLES; i += 1) {
    seconds += TRACK_CELLS / SAMPLES / Math.sqrt(TEMPO[i]! * TEMPO[i + 1]!);
  }
  return seconds;
})();

/** Bisection steps the per-step limit takes to find how far a step may go. */
const LIMIT_STEPS = 24;

/**
 * One step of playback: `dt` real seconds on along the track at `pace` times the chapters' own,
 * slowed by the tempo there and by `hush` (the scene's own, while the world changes), and held
 * so the Sun's look changes by no more than `CHANGE_PER_S` a second at that pace; never past a
 * chapter's end in one leap.
 */
export function advancePlay(age: number, dt: number, pace: number, hush = 1) {
  const from = ageToSlider(age);
  let reach = (dt * pace * hush * tempoAt(from)) / TRACK_CELLS;
  /* The track's end is the last moment exactly, so the clock stops there. */
  if (from + reach >= 1) return END_AGE;
  const now = sunAt(age);
  const most = CHANGE_PER_S * dt * pace * hush;
  if (lookChange(now, sunAt(sliderToAge(from + reach))) > most) {
    let lo = 0;
    let hi = reach;
    for (let step = 0; step < LIMIT_STEPS; step += 1) {
      const mid = (lo + hi) / 2;
      if (lookChange(now, sunAt(sliderToAge(from + mid))) > most) hi = mid;
      else lo = mid;
    }
    /* A step too small to measure still moves on: the track has no true jump, only steep stretches. */
    reach = lo > 0 ? lo : hi;
  }
  const next = sliderToAge(from + reach);
  const chapter = chapterOf(age);
  /* A step that would cross into the next chapter lands on its first moment, so no chapter is skipped. */
  if (next > chapter.until && chapter.until < END_AGE) return chapter.until;
  return Math.min(next, END_AGE);
}
