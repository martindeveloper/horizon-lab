import { horizonOf, type Camera, type Ladder, type Stage } from "./ladder";

export const SURFACE_ZOOMS = [1, 4, 16] as const;
export type SurfaceZoom = (typeof SURFACE_ZOOMS)[number];

/** Magnify the whole scene about the focused body's centre; sizes and rulers stay physical. */
export function inspectCamera(
  camera: Camera,
  ladder: Ladder,
  focus: number,
  stage: Stage,
  zoom: number,
) {
  const amount = Math.max(1, Math.min(16, zoom));
  const centre = ladder.centres[focus]!;
  const polar = ladder.sizes[focus]!.polar;
  const anchorY = horizonOf(stage) - polar / camera.scale;
  camera.centre = centre + (camera.centre - centre) / amount;
  camera.scale /= amount;
  camera.horizon = anchorY + polar / camera.scale;
  return camera;
}
