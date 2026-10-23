/**
 * The space scenes' side of the shared render quality: what a level (and the device class)
 * means for the scene host and for the shared solar system and sky any space scene draws. Each
 * simulation's own `lib/quality.ts` extends this with its layers' budgets; engines pass the
 * result down, so no layer reads the level or the device class itself.
 */
import type { RenderQuality } from "@horizon/toolkit/rendering";
import { defaultSceneResolution, type SceneResolution } from "@horizon/toolkit/scene";

import type { SkyCounts } from "./sky/milky-way";

/**
 * How much a space scene builds: what phones always drew (`light`), what desktops drew
 * (`full`), and half as much again (`max`).
 */
export type SceneTier = "light" | "full" | "max";

export type ByTier<T> = Readonly<Record<SceneTier, T>>;

/** Standard keeps each device's tier; Economy and Cinematic pin one; Max goes past both. */
export function sceneTier(quality: RenderQuality, tight: boolean): SceneTier {
  if (quality === "economy") return "light";
  if (quality === "standard") return tight ? "light" : "full";
  if (quality === "cinema") return "full";
  return "max";
}

/**
 * Pixel ratio and frame-rate caps: Standard is the host's default. Max lifts the frame-rate cap
 * everywhere and draws at the device's own ratio, up to 2 on tight devices, where a bigger buffer
 * could cost the WebGL context its memory.
 */
function sceneResolution(quality: RenderQuality, tight: boolean): SceneResolution {
  if (quality === "economy") return { dprCap: 1, fps: 30 };
  if (quality === "standard") return defaultSceneResolution(tight);
  if (quality === "cinema") return tight ? { dprCap: 1.5, fps: 48 } : { dprCap: 2, fps: Infinity };
  return { dprCap: tight ? 2 : 3, fps: Infinity };
}

/**
 * The lens's spikes: the bloom chain level its lights are found in (cells about a thirty-second
 * of the frame wide, at the tier's chain scale), and a spike's greatest length as a share of the
 * frame's height.
 */
export type LensChain = { level: number; reach: number };

/** Light devices draw shorter spikes at most; Max lets the brightest reach further. */
const LENS: ByTier<LensChain> = {
  light: { level: 3, reach: 0.18 },
  full: { level: 4, reach: 0.25 },
  max: { level: 4, reach: 0.32 },
};

/** The bloom chain's size: its levels, and the first level's share of the frame. */
export type BloomChain = { mips: number; scale: number };

/**
 * Light devices blur a quarter-resolution frame through four levels; the full tier a half-
 * resolution one through five; Max adds a sixth, wider level.
 */
const BLOOM: ByTier<BloomChain> = {
  light: { mips: 4, scale: 0.25 },
  full: { mips: 5, scale: 0.5 },
  max: { mips: 6, scale: 0.5 },
};

/** Small bodies in each GPU swarm. */
export type SwarmCounts = { belt: number; trojans: number; kuiper: number; oort: number };

const SWARMS: ByTier<SwarmCounts> = {
  light: { belt: 1400, trojans: 360, kuiper: 1600, oort: 2000 },
  full: { belt: 2600, trojans: 640, kuiper: 3000, oort: 3800 },
  max: { belt: 3900, trojans: 960, kuiper: 4500, oort: 5700 },
};

/** The painted sky's points: the Milky Way's resolved grains and the faint field stars. */
const SKY: ByTier<SkyCounts> = {
  light: { milkyWay: 12_000, fieldStars: 900 },
  full: { milkyWay: 30_000, fieldStars: 1_600 },
  max: { milkyWay: 45_000, fieldStars: 2_400 },
};

/** Close-ups: the lighter near map tier and painted detail, their filtering, and the atmosphere shell's samples. */
export type CloseUpQuality = { light: boolean; anisotropy: number; airSteps: number };

/** The atmosphere shell marches 6, 12 or 20 samples along each view ray; it draws at every level. */
const CLOSE_UP: ByTier<CloseUpQuality> = {
  light: { light: true, anisotropy: 4, airSteps: 6 },
  full: { light: false, anisotropy: 4, airSteps: 12 },
  max: { light: false, anisotropy: 16, airSteps: 20 },
};

/** What every space scene draws at a quality. */
export type SpaceQuality = {
  tier: SceneTier;
  resolution: SceneResolution;
  swarms: SwarmCounts;
  sky: SkyCounts;
  bloom: BloomChain;
  lens: LensChain;
  closeUp: CloseUpQuality;
};

export function spaceQuality(quality: RenderQuality, tight: boolean): SpaceQuality {
  const tier = sceneTier(quality, tight);
  return {
    tier,
    resolution: sceneResolution(quality, tight),
    swarms: SWARMS[tier],
    sky: SKY[tier],
    bloom: BLOOM[tier],
    lens: LENS[tier],
    closeUp: CLOSE_UP[tier],
  };
}
