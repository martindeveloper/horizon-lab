/**
 * Afterglow's dry Earth: a modelled map of the surface once the oceans are gone, built by
 * scripts/build-dry-earth.mjs from the Blue Marble relief and served beside the measured maps.
 * Safe for scripts (no app imports beyond the asset key).
 */
import type { MapTier } from "@horizon/toolkit/bodies";

export const DRY_EARTH_MAP = {
  folder: "earth-dry",
  version: 1,
  widths: { far: 1024, nearLight: 2048, near: 4096 },
} as const satisfies { folder: string; version: number; widths: Record<MapTier, number> };

/** The dry map's file at a tier under the maps' base URL. */
export const dryEarthFile = (base: string, tier: MapTier) =>
  `${base}/${DRY_EARTH_MAP.folder}/v${DRY_EARTH_MAP.version}/${DRY_EARTH_MAP.folder}-${tier}.webp`;
