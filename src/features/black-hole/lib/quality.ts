/**
 * What each render quality means for the black hole: ray-march steps per pixel, the share of
 * the stage traced, and the work budget (pixels, pixel ratio, frame rate), with a smaller one
 * for touch or battery operation (`constrained`). The engine, the bench and the technical copy
 * read this table; nothing else picks numbers by level.
 */
import type { BloomSettings } from "@horizon/toolkit/rendering";

import type { Quality } from "./holes/types";

/** The bloom chain's size: its levels, and the first level's share of the traced frame. */
type BloomChain = Pick<BloomSettings, "mips" | "scale">;

/** A frame's work: buffer pixels and pixels per CSS pixel at most, frames per second, the bloom chain. */
type WorkBudget = {
  pixels: number;
  dprCap: number;
  /** Target frame rate at rest and while the view moves. */
  fps: { idle: number; active: number };
  bloom: BloomChain;
};

/** Quarter-resolution bloom through four levels, for Economy and for touch or battery operation. */
const SMALL_BLOOM: BloomChain = { mips: 4, scale: 0.25 };
/** Half-resolution bloom through five levels. */
const BLOOM: BloomChain = { mips: 5, scale: 0.5 };

type BlackHoleQuality = {
  /** Integration steps per pixel. */
  steps: number;
  /** Share of the stage's resolution traced, before the pixel budget. */
  scale: number;
  budget: WorkBudget;
  /** On touch or battery: Max spends more than Cinematic there too, within a phone's means. */
  constrained: WorkBudget;
};

export const BLACK_HOLE_QUALITY: Readonly<Record<Quality, BlackHoleQuality>> = {
  economy: {
    steps: 144,
    scale: 0.72,
    budget: { pixels: 600_000, dprCap: 1, fps: { idle: 24, active: 24 }, bloom: SMALL_BLOOM },
    constrained: { pixels: 600_000, dprCap: 1, fps: { idle: 24, active: 24 }, bloom: SMALL_BLOOM },
  },
  standard: {
    steps: 192,
    scale: 0.9,
    budget: { pixels: 1_200_000, dprCap: 1, fps: { idle: 30, active: 30 }, bloom: BLOOM },
    constrained: { pixels: 800_000, dprCap: 1, fps: { idle: 30, active: 30 }, bloom: SMALL_BLOOM },
  },
  cinema: {
    steps: 256,
    scale: 1,
    budget: { pixels: 2_400_000, dprCap: 1.5, fps: { idle: 30, active: 60 }, bloom: BLOOM },
    constrained: { pixels: 800_000, dprCap: 1, fps: { idle: 30, active: 30 }, bloom: SMALL_BLOOM },
  },
  max: {
    steps: 384,
    scale: 1,
    budget: {
      pixels: 8_300_000,
      dprCap: 2,
      fps: { idle: 60, active: 60 },
      bloom: { mips: 6, scale: 0.5 },
    },
    constrained: { pixels: 2_400_000, dprCap: 1.5, fps: { idle: 60, active: 60 }, bloom: BLOOM },
  },
};

/** Hard work budgets apply even when the browser cannot report battery state. */
export function renderBudget(quality: Quality, constrained: boolean, active: boolean) {
  const level = BLACK_HOLE_QUALITY[quality];
  const budget = constrained ? level.constrained : level.budget;
  return {
    pixels: budget.pixels,
    dprCap: budget.dprCap,
    fps: active ? budget.fps.active : budget.fps.idle,
    bloom: budget.bloom,
  };
}

/**
 * The observatory's bloom, in radiance before the exposure is applied: light the tone map would
 * show brighter than about two thirds of white glows in full, eased in from about a fifth, a
 * pixel counting at most eight times the threshold, and the glow returns at half strength.
 */
export const BLACK_HOLE_BLOOM = { strength: 0.5, threshold: 0.7, knee: 0.5, clamp: 8 };

/** This frame's bloom: the look above in the scene's units, through the level's chain. */
export function bloomSettings(
  quality: Quality,
  constrained: boolean,
  exposure: number,
): BloomSettings {
  const scale = 1 / Math.max(exposure, 0.05);
  return {
    strength: BLACK_HOLE_BLOOM.strength,
    threshold: BLACK_HOLE_BLOOM.threshold * scale,
    knee: BLACK_HOLE_BLOOM.knee * scale,
    clamp: BLACK_HOLE_BLOOM.clamp * scale,
    ...renderBudget(quality, constrained, false).bloom,
  };
}

/** The share of the stage traced: the level's scale, held under its pixel budget. */
export function renderScale(
  quality: Quality,
  width: number,
  height: number,
  dpr: number,
  constrained: boolean,
) {
  const budget = renderBudget(quality, constrained, false);
  const density = Math.min(dpr, budget.dprCap);
  return Math.min(
    BLACK_HOLE_QUALITY[quality].scale,
    Math.sqrt(budget.pixels / Math.max(1, width * height * density * density)),
  );
}
