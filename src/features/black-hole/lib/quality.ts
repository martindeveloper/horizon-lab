/**
 * What each render quality means for the black hole: ray-march steps per pixel, the share of
 * the stage traced, and the work budget (pixels, pixel ratio, frame rate), with a smaller one
 * for touch or battery operation (`constrained`). The engine, the bench and the technical copy
 * read this table; nothing else picks numbers by level.
 */
import type { Quality } from "./holes/types";

/** A frame's work: buffer pixels and pixels per CSS pixel at most, frames per second. */
type WorkBudget = {
  pixels: number;
  dprCap: number;
  /** Target frame rate at rest and while the view moves. */
  fps: { idle: number; active: number };
};

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
    budget: { pixels: 600_000, dprCap: 1, fps: { idle: 24, active: 24 } },
    constrained: { pixels: 600_000, dprCap: 1, fps: { idle: 24, active: 24 } },
  },
  standard: {
    steps: 192,
    scale: 0.9,
    budget: { pixels: 1_200_000, dprCap: 1, fps: { idle: 30, active: 30 } },
    constrained: { pixels: 800_000, dprCap: 1, fps: { idle: 30, active: 30 } },
  },
  cinema: {
    steps: 256,
    scale: 1,
    budget: { pixels: 2_400_000, dprCap: 1.5, fps: { idle: 30, active: 60 } },
    constrained: { pixels: 800_000, dprCap: 1, fps: { idle: 30, active: 30 } },
  },
  max: {
    steps: 384,
    scale: 1,
    budget: { pixels: 8_300_000, dprCap: 2, fps: { idle: 60, active: 60 } },
    constrained: { pixels: 2_400_000, dprCap: 1.5, fps: { idle: 60, active: 60 } },
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
