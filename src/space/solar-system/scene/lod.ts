/**
 * Level of detail for every solar system layer, in one place:
 *
 * - size: how many CSS pixels a world length covers at a distance (`pxWorld`, `px`);
 * - presence: soft log-distance bands (`fade`) and one framing rule (`framed`) instead of
 *   hard thresholds, so nothing pops while the zoom glides;
 * - switches: faders that ease a layer in and out over time when a toggle or an era flips;
 * - levels: discrete choices (globe meshes) with hysteresis (`pickLevel`);
 * - need: each frame, layers report how large each body is now and where the zoom is
 *   heading (`see`), and the map budget loads and releases surfaces from that.
 *
 * Presence, framing, levels and faders are the toolkit's (`@horizon/toolkit/scene`).
 */
import type { PerspectiveCamera } from "three";

import { MAX_ECCENTRICITY, type BodyId, type Elements } from "@horizon/toolkit/bodies";
import { createFaders, createScreenScale, framed, type Viewport } from "@horizon/toolkit/scene";

/** How much of an orbit to draw at camera distance `d`: the framing rule from peri- to apoapsis. */
export function orbitShown(el: Elements, elliptical: boolean, d: number) {
  const e = elliptical ? Math.min(MAX_ECCENTRICITY, el.e) : 0;
  return framed(el.a * (1 - e), el.a * (1 + e), d);
}

export type Lod = ReturnType<typeof createLod>;

/** One per engine: call `begin` each frame once the camera is placed. */
export function createLod(camera: PerspectiveCamera, viewport: Pick<Viewport, "height">) {
  const need = new Map<BodyId, number>();
  const faders = createFaders();
  const { pxWorld, px } = createScreenScale(camera, viewport);

  const lod = {
    /** Camera distance from its aim, au. */
    dist: 1,
    /** How much larger things near the aim will be once the zoom arrives (≥ 1). */
    lead: 1,
    /** World size of `px` CSS pixels at `distance` from the camera. */
    pxWorld,
    /** On-screen radius in CSS pixels of a sphere of world radius `r` centred at `at`. */
    px,
    /** A body is `px` across now; the map budget loads for the larger of now and arrival. */
    see(id: BodyId, px: number) {
      const ahead = px * lod.lead;
      if (ahead > (need.get(id) ?? 0)) need.set(id, ahead);
    },
    /** The largest size each body was reported at this frame, toward the zoom's destination. */
    get need(): ReadonlyMap<BodyId, number> {
      return need;
    },
    /** A fader moved this frame and has further to go: keep frames coming. */
    get busy() {
      return faders.busy;
    },
    /** A fader's first call shows the switch as it is; only later changes ease. */
    fader: faders.fader,
    /** A new frame: camera distance and where the zoom is heading, both au. */
    begin(frameDt: number, dist: number, target: number) {
      faders.begin(frameDt);
      need.clear();
      lod.dist = dist;
      lod.lead = Math.min(64, Math.max(1, dist / Math.max(1e-12, target)));
    },
  };
  return lod;
}
