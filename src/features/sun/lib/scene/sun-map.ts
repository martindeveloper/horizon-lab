/**
 * The measured Sun: SDO/HMI's flattened continuum map (`MAPS.sun`), streamed from the CDN as
 * the Orrery streams its bodies' maps. The far tier loads after the first frame and the tier
 * the quality allows right behind it, so the disc sharpens as soon as it can; the finest
 * resident one is drawn. A failed load leaves the procedural surface.
 */
import type { Texture } from "three";

import { MAP_BASE } from "@/space/solar-system/graphics/maps";
import { MAPS, tierFile, type MapTier } from "@horizon/toolkit/bodies";
import type { DisposalScope } from "@horizon/toolkit/rendering";
import { loadMap } from "@horizon/toolkit/scene";

export function createSunMap(
  scope: DisposalScope,
  options: {
    /** The tier the quality allows besides `far`. */
    tier: () => MapTier;
    /** A map arrived: upload it; `width` is its pixels round the equator. */
    onLoad: (texture: Texture, width: number) => void;
    wake: () => void;
  },
) {
  const abort = new AbortController();
  const loaded = new Map<MapTier, Texture>();
  let loading: MapTier | null = null;
  let shown: MapTier | null = null;
  let started = false;
  scope.defer(() => {
    abort.abort();
    for (const texture of loaded.values()) texture.dispose();
    loaded.clear();
  });
  const widths = MAPS.sun?.widths;

  const load = (tier: MapTier) => {
    const file = widths && tierFile(MAP_BASE, "sun", tier);
    if (!file || loading || loaded.has(tier)) return;
    loading = tier;
    loadMap(file, abort.signal).then(
      (texture) => {
        loading = null;
        if (abort.signal.aborted) {
          texture.dispose();
          return;
        }
        loaded.set(tier, texture);
        /* The finest resident tier is the one drawn. */
        if (widths && (!shown || widths[tier] > widths[shown])) {
          shown = tier;
          options.onLoad(texture, widths[tier]);
        }
        options.wake();
      },
      () => {
        loading = null;
      },
    );
  };

  return {
    /** Each frame: the far tier first, then the quality's tier (which may change with the quality). */
    update() {
      if (!started) {
        started = true;
        load("far");
      }
      const near = options.tier();
      if (near !== "far" && loaded.has("far")) load(near);
    },
  };
}
