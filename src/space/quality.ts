/**
 * The space scenes' side of the shared render quality: what a level (and the device class)
 * means for the scene host and for the solar system both the Orrery and Deep Field draw. Each
 * simulation's own `lib/quality.ts` extends this with its layers' budgets; engines pass the
 * result down, so no layer reads the level or the device class itself.
 */
import type { RenderQuality } from "@horizon/toolkit/rendering";
import { defaultSceneResolution, type SceneResolution } from "@horizon/toolkit/scene";

/**
 * How much a space scene builds: what phones always drew (`light`), what desktops drew
 * (`full`), and half as much again (`max`).
 */
export type SceneTier = "light" | "full" | "max";

/** A value for each tier. */
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
export function sceneResolution(quality: RenderQuality, tight: boolean): SceneResolution {
  if (quality === "economy") return { dprCap: 1, fps: 30 };
  if (quality === "standard") return defaultSceneResolution(tight);
  if (quality === "cinema") return tight ? { dprCap: 1.5, fps: 48 } : { dprCap: 2, fps: Infinity };
  return { dprCap: tight ? 2 : 3, fps: Infinity };
}

/** Small bodies in each GPU swarm. */
export type SwarmCounts = { belt: number; trojans: number; kuiper: number; oort: number };

const SWARMS: ByTier<SwarmCounts> = {
  light: { belt: 1400, trojans: 360, kuiper: 1600, oort: 2000 },
  full: { belt: 2600, trojans: 640, kuiper: 3000, oort: 3800 },
  max: { belt: 3900, trojans: 960, kuiper: 4500, oort: 5700 },
};

/** What every space scene draws at a quality. */
export type SpaceQuality = {
  tier: SceneTier;
  resolution: SceneResolution;
  swarms: SwarmCounts;
};

export function spaceQuality(quality: RenderQuality, tight: boolean): SpaceQuality {
  const tier = sceneTier(quality, tight);
  return { tier, resolution: sceneResolution(quality, tight), swarms: SWARMS[tier] };
}
