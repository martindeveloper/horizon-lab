/** Shared pieces of the orrery renderer: constants, the per-engine kit and the per-frame state. */
import type { PerspectiveCamera } from "three";

import { SUN_RADIUS_KM, type BodyId, type PlanetId } from "@horizon/toolkit/bodies";
import type { DisposalScope } from "@horizon/toolkit/rendering";
import { AU_KM } from "@horizon/toolkit/science";

import type { Looks } from "../graphics/looks";
import type { Selection, Show } from "../store";

export const FOV = 48;
/** Outer edge of the solar map (AU) and the closest Galaxy-map approach to the Sun (ly). */
export const SOLAR_EDGE = 800_000;
export const GALAXY_NEAR = 1_500;
export const SUN_R = SUN_RADIUS_KM / AU_KM;
export const ORBIT_INCLINATION = { min: -1.45, max: 1.45 };
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
/** The gold of selections, rulers and the Sun's galactic trail. */
export const GOLD = 0xe2c07a;

/** Label lookup by key, translated by the host component. */
export type Labels = () => Record<string, string>;

/** CSS size of the stage, written on resize. */
export type Viewport = { width: number; height: number };

/** What every layer is built with. */
export type SceneKit = {
  scope: DisposalScope;
  looks: Looks;
  camera: PerspectiveCamera;
  viewport: Viewport;
  /** Phones and low-memory devices: smaller samples and buffers. */
  tight: boolean;
  dpr: number;
  /** World size of `px` screen pixels at distance `dist`. */
  pxWorld: (dist: number, px: number) => number;
};

/** The model state one frame draws. */
export type Frame = {
  dt: number;
  now: Date;
  show: Show;
  sel: Selection | null;
  yearsAgo: number;
  playing: boolean;
  /** Neptune's migration, 0..1. */
  mig: number;
  driftYears: number;
  /** Camera distance from its target. */
  dist: number;
  present: boolean;
};

export function createPxWorld(viewport: Viewport) {
  const tan = 2 * Math.tan((FOV * Math.PI) / 360);
  return (dist: number, px: number) => ((tan * dist) / Math.max(480, viewport.height)) * px;
}

/** Hides a body's own label, orbit and marker once a close-up of it fills the view. */
export type HidesFor = (id: BodyId) => boolean;
