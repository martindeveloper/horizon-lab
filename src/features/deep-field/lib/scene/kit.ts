/** Shared pieces of the Deep Field renderer: constants, the per-engine kit and the per-frame state. */
import type { SolarShow } from "@/space/solar-system/scene/kit";
import type { LabelInsets, SceneHostBasics } from "@horizon/toolkit/scene";

import type { Looks } from "../graphics/looks";
import type { Selection, Show } from "../store";
import type { Lod } from "./lod";

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
 * height as the eyepiece publishes it) and clear of the depth ladder, down the left on wide
 * screens and along the bottom on phones (as depth-ladder.tsx lays it out).
 */
export function labelInsets(wide: boolean, clear: number): LabelInsets {
  return wide
    ? { top: 56, bottom: clear, left: 168, right: 4 }
    : { top: 56, bottom: clear + 72, left: 4, right: 4 };
}

/** What every layer is built with: the host's basics, the looks and the level of detail. */
export type SceneKit = SceneHostBasics & {
  looks: Looks;
  /** Screen size, presence bands, faders and the scale blend (see lod.ts). */
  lod: Lod;
  /** World size of `px` screen pixels at distance `dist`: `lod.pxWorld`. */
  pxWorld: (dist: number, px: number) => number;
};

/** The model state one frame draws. */
export type Frame = {
  show: Show;
  sel: Selection | null;
  /** Camera distance from its aim, au. */
  dist: number;
};
