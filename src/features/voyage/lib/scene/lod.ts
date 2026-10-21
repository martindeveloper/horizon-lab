/**
 * Level of detail for a scene whose camera sits at the origin: how many pixels a body covers
 * (`px`, in CSS px; the map budget wants device px), faders that ease switches, and the need
 * each frame's bodies report for their measured maps.
 */
import type { PerspectiveCamera } from "three";

import type { BodyId } from "@horizon/toolkit/bodies";
import { createFaders, createScreenScale, type Viewport } from "@horizon/toolkit/scene";

export type Lod = ReturnType<typeof createLod>;

export function createLod(
  camera: PerspectiveCamera,
  viewport: Pick<Viewport, "height">,
  dpr: { value: number },
) {
  const need = new Map<BodyId, number>();
  const faders = createFaders();
  const { pxWorld, px } = createScreenScale(camera, viewport);
  return {
    /** World size of `px` CSS pixels at `distance` from the camera (the kit's contract). */
    pxWorld,
    /** On-screen radius in CSS pixels of a sphere of world radius `r` centred at `at`. */
    px,
    /** A body is `rPx` CSS pixels in radius this frame: the map budget sizes its map by it. */
    see(id: BodyId, rPx: number) {
      need.set(id, rPx * dpr.value);
    },
    /** Each body's on-screen radius this frame, device px. */
    get need(): ReadonlyMap<BodyId, number> {
      return need;
    },
    /** A fader moved this frame and has further to go: keep frames coming. */
    get busy() {
      return faders.busy;
    },
    fader: faders.fader,
    /** A new frame. */
    begin(frameDt: number) {
      faders.begin(frameDt);
      need.clear();
    },
  };
}
