/** Shared pieces of the orrery renderer: constants, the per-engine kit and the per-frame state. */
import type { PerspectiveCamera } from "three";

import { SUN_RADIUS_KM, type BodyId, type PlanetId } from "@horizon/toolkit/bodies";
import type { DisposalScope } from "@horizon/toolkit/rendering";
import { AU_KM } from "@horizon/toolkit/science";

import type { Looks } from "../graphics/looks";
import type { Selection, Show } from "../store";
import type { Lod } from "./lod";

export const FOV = 48;
/** Farthest a close-up flight may carry the camera (au). */
export const SOLAR_EDGE = 800_000;
/** Closest approach to the galactic centre while the bulge card holds the aim there (ly). */
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
  /** Screen size, presence bands, faders and the realm blend (see lod.ts). */
  lod: Lod;
  /** World size of `px` screen pixels at distance `dist`: `lod.pxWorld`. */
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
  /** Camera distance from its aim, au. */
  dist: number;
  present: boolean;
};

/** 1 while a body's own label, orbit and marker show; eases to 0 as its close-up fills the view. */
export type ShownFor = (id: BodyId) => number;
