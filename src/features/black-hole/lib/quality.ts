/**
 * What each render quality means for the black hole: ray-march steps per pixel, the share of
 * the stage traced, and the work budget (pixels, pixel ratio, frame rate), with a smaller one
 * for touch or battery operation (`constrained`). The engine, the bench and the technical copy
 * read this table; nothing else picks numbers by level.
 */
import type { BloomSettings, LensSettings } from "@horizon/toolkit/rendering";

import type { Quality } from "./holes/types";

/** The bloom chain's size: its levels, and the first level's share of the traced frame. */
type BloomChain = Pick<BloomSettings, "mips" | "scale">;

/**
 * The lens's spikes: the bloom chain level its lights are found in (cells about a thirty-second
 * of the traced frame, at the chain's scale), and a spike's greatest length as a share of its
 * height.
 */
type LensChain = Pick<LensSettings, "level" | "reach">;

/** A frame's work: buffer pixels and pixels per CSS pixel at most, frames per second, the bloom chain, the lens. */
type WorkBudget = {
  pixels: number;
  dprCap: number;
  /** Target frame rate at rest and while the view moves. */
  fps: { idle: number; active: number };
  bloom: BloomChain;
  lens: LensChain;
};

/** Quarter-resolution bloom through four levels, for Economy and for touch or battery operation. */
const SMALL_BLOOM: BloomChain = { mips: 4, scale: 0.25 };
/** Half-resolution bloom through five levels. */
const BLOOM: BloomChain = { mips: 5, scale: 0.5 };
/** Shorter spikes at most, from the quarter-size chain, for Economy and for touch or battery operation. */
const SMALL_LENS: LensChain = { level: 3, reach: 0.18 };
/** Spikes over a quarter of the frame at most, from the half-size chain. */
const LENS: LensChain = { level: 4, reach: 0.25 };
/** Max's spikes: the brightest reach further. */
const LONG_LENS: LensChain = { level: 4, reach: 0.32 };

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
    budget: {
      pixels: 600_000,
      dprCap: 1,
      fps: { idle: 24, active: 24 },
      bloom: SMALL_BLOOM,
      lens: SMALL_LENS,
    },
    constrained: {
      pixels: 600_000,
      dprCap: 1,
      fps: { idle: 24, active: 24 },
      bloom: SMALL_BLOOM,
      lens: SMALL_LENS,
    },
  },
  standard: {
    steps: 192,
    scale: 0.9,
    budget: {
      pixels: 1_200_000,
      dprCap: 1,
      fps: { idle: 30, active: 30 },
      bloom: BLOOM,
      lens: LENS,
    },
    constrained: {
      pixels: 800_000,
      dprCap: 1,
      fps: { idle: 30, active: 30 },
      bloom: SMALL_BLOOM,
      lens: SMALL_LENS,
    },
  },
  cinema: {
    steps: 256,
    scale: 1,
    budget: {
      pixels: 2_400_000,
      dprCap: 1.5,
      fps: { idle: 30, active: 60 },
      bloom: BLOOM,
      lens: LENS,
    },
    constrained: {
      pixels: 800_000,
      dprCap: 1,
      fps: { idle: 30, active: 30 },
      bloom: SMALL_BLOOM,
      lens: SMALL_LENS,
    },
  },
  max: {
    steps: 384,
    scale: 1,
    budget: {
      pixels: 8_300_000,
      dprCap: 2,
      fps: { idle: 60, active: 60 },
      bloom: { mips: 6, scale: 0.5 },
      lens: LONG_LENS,
    },
    constrained: {
      pixels: 2_400_000,
      dprCap: 1.5,
      fps: { idle: 60, active: 60 },
      bloom: BLOOM,
      lens: LENS,
    },
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
    lens: budget.lens,
  };
}

/**
 * The most pixels a recorded march (trace-cache.ts, 64 bytes each) may cover: what Cinematic
 * draws on this device, the highest level held to its means. That is 2.4 million pixels (about
 * 150 MB), or 0.8 million (about 50 MB) on touch or battery. Max lifts the device caps, so a
 * larger frame marches every frame instead of holding a record the device may not afford.
 */
export function recordPixels(constrained: boolean) {
  return renderBudget("cinema", constrained, false).pixels;
}

/**
 * The observatory's bloom, in radiance before the tone map's exposure is applied: light it would
 * show brighter than about two thirds of white glows in full, eased in from about a fifth, a
 * pixel counting at most eight times the threshold, and the glow returns at half strength.
 */
export const BLACK_HOLE_BLOOM = { strength: 0.5, threshold: 0.7, knee: 0.5, clamp: 8 };

/** This frame's bloom at the tone map's `exposure` (`toneExposure`): the look above in the scene's units, through the level's chain. */
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

/**
 * The observatory's lens, in radiance before the tone map's exposure is applied: a four-point star on each
 * compact light the bloom's mask holds (a hot spot, a bright star; the disk itself is too wide
 * to spike), its spikes drawn until they fade to 0.01, carrying twice their light, and
 * a fringe of 1.5 pixels at the corners. The frame is radiance, so every light spikes in full.
 */
export const BLACK_HOLE_LENS = {
  strength: 2,
  threshold: 0.01,
  full: 0,
  arms: 4,
  fringe: 1.5,
} as const;

/** This frame's lens at the tone map's `exposure`: the look above in the scene's units, with the level's cells and reach. */
export function lensSettings(
  quality: Quality,
  constrained: boolean,
  exposure: number,
): LensSettings {
  const scale = 1 / Math.max(exposure, 0.05);
  return {
    mask: bloomSettings(quality, constrained, exposure),
    threshold: BLACK_HOLE_LENS.threshold * scale,
    full: BLACK_HOLE_LENS.full,
    arms: BLACK_HOLE_LENS.arms,
    strength: BLACK_HOLE_LENS.strength,
    fringe: BLACK_HOLE_LENS.fringe,
    ...renderBudget(quality, constrained, false).lens,
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
