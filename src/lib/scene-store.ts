/**
 * What every zoomable scene's store holds besides its view and selection: the fields its
 * engine's bridge reads, the visitor's distance unit and the scale bar the HUD writes. Types
 * only from the toolkit's scene, so a store never pulls the renderer into the page.
 */
import type { OrbitTurn } from "@horizon/toolkit/camera";
import type { ScaleReadout } from "@horizon/toolkit/scene";
import type { DistanceChoice } from "@horizon/toolkit/science";

/** What the engine's bridge reads of a simulation's store. */
export type SceneStoreState = {
  view: unknown;
  /** Bumps whenever the camera should fly to the view again. */
  flight: number;
  /** The latest button step for the camera; a new object each time. */
  turn: OrbitTurn | null;
  ready: boolean;
  setReady: (ready: boolean) => void;
};

/** The camera's angles round its aim, whole degrees: heading 0–359, tilt the elevation above the map's plane. */
export type CameraAngles = { heading: number; tilt: number };

export type SceneSlice = Omit<SceneStoreState, "view"> &
  ScaleReadout & {
    /** Written by the HUD with the scale bar, for the camera pad's readout. */
    cameraAngles: CameraAngles;
    /** The visitor's readout unit; `auto` picks au or ly by each distance's size. */
    distanceUnit: DistanceChoice;
    rotate: (turn: OrbitTurn) => void;
    setDistanceUnit: (unit: DistanceChoice) => void;
  };

/** The shared fields at rest, with the scale bar's first reading, and their actions. */
export function sceneSlice(
  set: (patch: Partial<SceneSlice>) => void,
  scale: ScaleReadout,
): SceneSlice {
  return {
    flight: 0,
    turn: null,
    ready: false,
    distanceUnit: "auto",
    cameraAngles: { heading: 0, tilt: 0 },
    ...scale,
    rotate: (turn) => set({ turn: { ...turn } }),
    setDistanceUnit: (distanceUnit) => set({ distanceUnit }),
    setReady: (ready) => set({ ready }),
  };
}
