/** What every scene piece here is built with: a disposal scope, the camera and the stage size. */
import type { PerspectiveCamera } from "three";

import type { DisposalScope } from "../rendering/disposal";

/** CSS size of the stage, written on resize. */
export type Viewport = { width: number; height: number };

export type SceneBasics = {
  scope: DisposalScope;
  camera: PerspectiveCamera;
  viewport: Viewport;
};

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
