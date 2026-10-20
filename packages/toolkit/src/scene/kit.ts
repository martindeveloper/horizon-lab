/** What every scene piece here is built with: a disposal scope, the camera and the stage size. */
import type { PerspectiveCamera } from "three";

import type { DisposalScope } from "../rendering/disposal";
import type { SceneHostBasics } from "./host";

/** CSS size of the stage, written on resize. */
export type Viewport = { width: number; height: number };

export type SceneBasics = {
  scope: DisposalScope;
  camera: PerspectiveCamera;
  viewport: Viewport;
};

/**
 * What a scene's layers are built with: the host's basics, the materials they share (`Looks`)
 * and the level of detail (`Lod`) that gives the world size of a screen pixel at a distance.
 */
export type SceneKit<
  Looks,
  Lod extends { pxWorld: (dist: number, px: number) => number },
> = SceneHostBasics & {
  looks: Looks;
  lod: Lod;
  /** World size of `px` screen pixels at distance `dist`: `lod.pxWorld`. */
  pxWorld: (dist: number, px: number) => number;
};

/** A kit for a host's scene, from its looks and level of detail. */
export function sceneKit<Looks, Lod extends { pxWorld: (dist: number, px: number) => number }>(
  basics: SceneHostBasics,
  looks: Looks,
  lod: Lod,
): SceneKit<Looks, Lod> {
  return { ...basics, looks, lod, pxWorld: lod.pxWorld };
}

/** Label text by key, translated by the host component. */
export type LabelText = () => Record<string, string>;

/** What a page hands a scene engine: its canvas, the stage, a layer for labels and words. */
export type SceneMount = {
  canvas: HTMLCanvasElement;
  /** The element the canvas fills; its size is the stage's. */
  host: HTMLElement;
  /** Where `createLabels` puts its labels. */
  labelRoot: HTMLElement;
  labels: LabelText;
  /** The page's language, for numbers in labels. */
  locale: () => string;
  onError: (error: unknown) => void;
};

/** The theme's solar gold (`--color-solar`) for scene materials: selections, rulers, trails. */
export const SOLAR_GOLD = 0xe2c07a;

/**
 * World length one CSS pixel covers `distance` from a perspective camera with a vertical
 * `fov` in degrees, on a stage `height` CSS pixels tall.
 */
export const worldPerPixel = (fov: number, distance: number, height: number) =>
  (2 * Math.tan((fov * Math.PI) / 360) * distance) / height;
