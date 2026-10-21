/**
 * Level of detail for every layer of the shared worlds, in one place: the toolkit's screen
 * size, presence bands and faders, and the blend between the three scales (frames.ts).
 */
import type { PerspectiveCamera } from "three";

import { createFaders, createScreenScale, type Viewport } from "@horizon/toolkit/scene";

import type { Realm } from "../show";
import { cosmosMix, galaxyMix, realmOf } from "./frames";

export type Lod = ReturnType<typeof createLod>;

/** One per engine: call `begin` each frame once the camera is placed. */
export function createLod(camera: PerspectiveCamera, viewport: Pick<Viewport, "height">) {
  const faders = createFaders();
  const { pxWorld, px } = createScreenScale(camera, viewport);
  const lod = {
    /** Camera distance from its aim, au. */
    dist: 1,
    /** 0 among the nearest stars … 1 in the Galaxy and beyond. */
    galaxy: 0,
    /** 0 up to the Galaxy … 1 on the cosmic map. */
    cosmos: 0,
    realm: "stars" as Realm,
    /** World size of `px` CSS pixels at `distance` from the camera. */
    pxWorld,
    /** On-screen radius in CSS pixels of a sphere of world radius `r` centred at `at`. */
    px,
    /** A fader moved this frame and has further to go: keep frames coming. */
    get busy() {
      return faders.busy;
    },
    /** A fader's first call shows the switch as it is; only later changes ease. */
    fader: faders.fader,
    /** A new frame at a camera distance in au. */
    begin(frameDt: number, dist: number) {
      faders.begin(frameDt);
      lod.dist = dist;
      lod.galaxy = galaxyMix(dist);
      lod.cosmos = cosmosMix(dist);
      lod.realm = realmOf(dist);
    },
  };
  return lod;
}
