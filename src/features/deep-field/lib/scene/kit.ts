/** Shared pieces of the Deep Field renderer: constants, the per-engine kit and the per-frame state. */
import type { Lod } from "@/space/galaxy/scene/lod";
import type { WorldFrame } from "@/space/galaxy/show";
import type { SolarShow } from "@/space/solar-system/scene/kit";
import { DEFAULT_INSETS, type LabelInsets, type SceneKit as Kit } from "@horizon/toolkit/scene";

import type { Looks } from "../graphics/looks";

/** The solar system as Deep Field draws it: today's populations and orbits, still. */
export const SOLAR_SHOW: SolarShow = {
  disk: false,
  kuiper: true,
  scattered: true,
  oort: true,
  ejected: false,
  plane: true,
  names: true,
  trueSize: false,
  elliptical: true,
  drift: false,
};

/** Closest approach to the galactic centre while the bulge card holds the aim there (ly). */
export const GALAXY_NEAR = 1_500;

/**
 * Where labels may sit around the HUD, CSS px: below the header, above the dock (`clear`, its
 * height as the sightline publishes it) and clear of the depth ladder, down the left on wide
 * screens and along the bottom on phones (as depth-ladder.tsx lays it out). While the guide
 * speaks, above its caption too (`caption`, 0 without one).
 */
export function labelInsets(wide: boolean, clear: number, caption = 0): LabelInsets {
  const bottom = Math.max(wide ? clear : clear + 72, caption);
  return wide ? { ...DEFAULT_INSETS, bottom, left: 168 } : { ...DEFAULT_INSETS, bottom };
}

/**
 * What every layer is built with: the host's basics, the looks and the level of detail (screen
 * size, presence bands, faders and the scale blend; `@/space/galaxy/scene/lod`).
 */
export type SceneKit = Kit<Looks, Lod>;

/** The model state one frame draws: the shared worlds' frame (`@/space/galaxy/show`). */
export type Frame = WorldFrame;
