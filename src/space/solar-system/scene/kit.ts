/** Shared pieces of the solar system scene: constants, the kit its layers are built with, a frame. */
import { SUN_RADIUS_KM, type BodyId, type PlanetId } from "@horizon/toolkit/bodies";
import { sceneKit, type SceneHostBasics, type SceneKit } from "@horizon/toolkit/scene";
import { AU_KM } from "@horizon/toolkit/science";

import { createLooks, type Looks } from "../graphics/looks";
import type { SolarMoment } from "../model/moment";
import type { SolarSelection } from "../model/selection";
import { createLod, type Lod } from "./lod";

export const SUN_R = SUN_RADIUS_KM / AU_KM;
export const ORBIT_COLOR: Record<PlanetId, number> = {
  mercury: 0x9a938a,
  venus: 0xcbb98a,
  earth: 0x6aa2c8,
  mars: 0xc8946a,
  jupiter: 0xd7a15a,
  saturn: 0xe0d2a4,
  uranus: 0x8ec9c4,
  neptune: 0x6f98c8,
};
/** The small worlds' orbits and Pluto's moons': a cool grey-blue; Halley's a comet's rust. */
export const SMALL_ORBIT_COLOR = 0x9ebccc;
export const COMET_ORBIT_COLOR = 0xc4705a;

/** The scene's switches. */
export type SolarShow = {
  disk: boolean;
  kuiper: boolean;
  scattered: boolean;
  oort: boolean;
  ejected: boolean;
  plane: boolean;
  names: boolean;
  trueSize: boolean;
  elliptical: boolean;
  drift: boolean;
};

/**
 * What every layer is built with: the host's basics, the looks and the level of detail (screen
 * size, presence bands, faders and the map budget; see lod.ts).
 */
export type SolarKit = SceneKit<Looks, Lod>;

/**
 * The kit for a host's scene: painted looks (lighter on tight devices) and a level of detail.
 * `streamed`: the host streams measured maps in, and bodies wait for them in their mean colour.
 */
export function createSolarKit(basics: SceneHostBasics, streamed = false): SolarKit {
  const looks = basics.scope.own(createLooks(basics.tight, streamed));
  return sceneKit(basics, looks, createLod(basics.camera, basics.viewport));
}

/** The state one frame draws: a moment, the clock, the switches and the camera distance. */
export type SolarFrame = SolarMoment & {
  dt: number;
  now: Date;
  show: SolarShow;
  sel: SolarSelection | null;
  playing: boolean;
  /** Camera distance from its aim, au. */
  dist: number;
};

/** 1 while a body's own label, orbit and marker show; eases to 0 as its close-up fills the view. */
export type ShownFor = (id: BodyId) => number;
