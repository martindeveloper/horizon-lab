/**
 * The measured Sun: SDO/HMI's flattened continuum map (`MAPS.sun`), streamed from the CDN as
 * the Orrery streams its bodies' maps. The far tier loads after the first frame and the tier
 * the quality allows right behind it, so the disc sharpens as soon as it can; the finest
 * that arrived is drawn and kept, a coarser one let go. A failed load leaves the procedural surface. Nothing waits on them:
 * `sharpening` says when the view is close enough to miss detail still on its way.
 */
import {
  ClampToEdgeWrapping,
  LinearFilter,
  NearestFilter,
  NoColorSpace,
  type Texture,
} from "three";

import { assetUrl } from "@/lib/assets";
import { MAP_BASE } from "@/space/solar-system/graphics/maps";
import { MAPS, tierFile, type MapTier } from "@horizon/toolkit/bodies";
import { TAU } from "@horizon/toolkit/math";
import type { DisposalScope } from "@horizon/toolkit/rendering";
import { loadMap } from "@horizon/toolkit/scene";

import stencil from "../graphics/spot-stencil.generated.json";
import { MAP_DETAIL_FROM_PX } from "../parameters";

export function createSunMap(
  scope: DisposalScope,
  options: {
    /** The tier the quality allows besides `far`. */
    tier: () => MapTier;
    /** A map arrived: upload it; `width` is its pixels round the equator. */
    onLoad: (texture: Texture, width: number) => void;
    /** Both linear-data textures arrived; neither may be used on its own. */
    onStencil: (atlas: Texture, pages: Texture) => void;
    wake: () => void;
  },
) {
  const abort = new AbortController();
  /* The tiers that arrived, and the finest of them, the one drawn; a coarser one is let go. */
  const arrived = new Set<MapTier>();
  let drawn: Texture | null = null;
  const failed = new Set<MapTier>();
  let loading: MapTier | null = null;
  let stencilLoading = false;
  let shown: MapTier | null = null;
  let started = false;
  const stencilTextures: Texture[] = [];
  scope.defer(() => {
    abort.abort();
    drawn?.dispose();
    drawn = null;
    for (const texture of stencilTextures) texture.dispose();
  });
  const widths = MAPS.sun?.widths;

  const loadStencil = async () => {
    // A stencil from a different observation must never replace the current photograph.
    if (MAPS.sun?.version !== stencil.mapVersion) return;
    stencilLoading = true;
    const results = await Promise.allSettled(
      [stencil.atlasFile, stencil.pagesFile].map(async (key, index) => {
        const texture = await loadMap(assetUrl(key), abort.signal, 1);
        if (abort.signal.aborted) {
          texture.dispose();
          return null;
        }
        const expectedWidth = index === 0 ? stencil.atlasWidth : stencil.width / stencil.tile;
        const expectedHeight = index === 0 ? stencil.atlasHeight : stencil.height / stencil.tile;
        const image = texture.image;
        if (
          typeof image !== "object" ||
          image === null ||
          !("width" in image) ||
          !("height" in image) ||
          image.width !== expectedWidth ||
          image.height !== expectedHeight
        ) {
          texture.dispose();
          throw new Error("Sun spot stencil dimensions do not match its metadata");
        }
        texture.colorSpace = NoColorSpace;
        texture.wrapS = texture.wrapT = ClampToEdgeWrapping;
        texture.generateMipmaps = false;
        texture.minFilter = texture.magFilter = index === 0 ? LinearFilter : NearestFilter;
        texture.needsUpdate = true;
        stencilTextures.push(texture);
        return texture;
      }),
    );
    stencilLoading = false;
    const atlas = results[0];
    const pages = results[1];
    if (abort.signal.aborted) return;
    if (
      atlas?.status === "fulfilled" &&
      atlas.value &&
      pages?.status === "fulfilled" &&
      pages.value
    ) {
      options.onStencil(atlas.value, pages.value);
    } else {
      for (const texture of stencilTextures) texture.dispose();
      stencilTextures.length = 0;
    }
    // A failed stencil leaves the photograph intact at every zoom; either way the wait is over.
    options.wake();
  };

  const load = (tier: MapTier) => {
    const file = widths && tierFile(MAP_BASE, "sun", tier);
    if (!file || loading || arrived.has(tier)) return;
    loading = tier;
    loadMap(file, abort.signal).then(
      (texture) => {
        loading = null;
        if (abort.signal.aborted) {
          texture.dispose();
          return;
        }
        arrived.add(tier);
        /* The finest tier that arrived is the one drawn. */
        if (widths && (!shown || widths[tier] > widths[shown])) {
          const previous = drawn;
          shown = tier;
          drawn = texture;
          options.onLoad(texture, widths[tier]);
          previous?.dispose();
        } else texture.dispose();
        options.wake();
      },
      () => {
        loading = null;
        failed.add(tier);
        options.wake();
      },
    );
  };

  return {
    /** Each frame: the far tier first, then the quality's tier (which may change with the quality). */
    update() {
      if (!started) {
        started = true;
        load("far");
        void loadStencil();
      }
      const near = options.tier();
      if (near !== "far" && arrived.has("far")) load(near);
    },
    /**
     * Whether detail is still on its way that the view would show: a texel of the drawn map
     * spans more buffer pixels than the shader's detail threshold at the nearest surface,
     * where a buffer pixel is `px` wide.
     */
    sharpening(px: number) {
      const near = options.tier();
      const awaited =
        stencilLoading ||
        loading !== null ||
        (near !== "far" && arrived.has("far") && !arrived.has(near) && !failed.has(near));
      if (!awaited || !widths) return false;
      return TAU / (widths[shown ?? "far"] * px) > MAP_DETAIL_FROM_PX;
    },
  };
}
