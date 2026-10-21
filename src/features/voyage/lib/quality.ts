/**
 * What each render quality means for Voyage, on top of the space scenes' share
 * (`spaceQuality`: resolution, bloom and lens chains). The engine maps the visitor's level
 * here once and hands each layer its part; no layer reads the level or the device class.
 * The eclipse count and the ring strip are baked into the materials at mount, so a level
 * changed mid-visit keeps the ones it started with.
 */
import type { CosmosDetail } from "@/space/cosmos/graphics/cosmos";
import { spaceQuality, type ByTier, type SpaceQuality } from "@/space/quality";
import type { SkyCounts } from "@/space/sky/milky-way";
import type { MapBudgetQuality } from "@/space/solar-system/scene/map-budget";
import type { RenderQuality } from "@horizon/toolkit/rendering";

/** The finest globe: segments around and across, for the body being flown by. */
export type GlobeDetail = { segments: number; rings: number };

type VoyageQuality = SpaceQuality & {
  globe: GlobeDetail;
  maps: MapBudgetQuality;
  /** Bodies each surface tests for an eclipse (fixed at mount). */
  occluders: number;
  /** Texels across a ring strip (fixed at mount). */
  ringTexels: number;
  /** The cosmic map's sampling. */
  cosmos: CosmosDetail;
  /** The painted sky's points: the Milky Way's grains and the faint field. */
  sky: SkyCounts;
};

const GLOBE: ByTier<GlobeDetail> = {
  light: { segments: 128, rings: 80 },
  full: { segments: 256, rings: 160 },
  max: { segments: 384, rings: 240 },
};

/** Resident map bytes, filtering, and the largest tier a globe may ask for. */
const MAPS: ByTier<MapBudgetQuality> = {
  light: { budget: 48e6, anisotropy: 2, allow: "nearLight" },
  full: { budget: 160e6, anisotropy: 4, allow: "near" },
  max: { budget: 384e6, anisotropy: 16, allow: "near" },
};
/** Max keeps a low-memory device's resident maps to the desktop budget, filtered as sharply. */
const TIGHT_MAX_MAPS: MapBudgetQuality = { ...MAPS.full, anisotropy: MAPS.max.anisotropy };

const OCCLUDERS: ByTier<number> = { light: 2, full: 4, max: 4 };
/** The cosmic map's sampling, as Deep Field's. */
const COSMOS: ByTier<CosmosDetail> = {
  light: { share: 0.6, filaments: 26, knots: 70, strand: 1.2, bridgeStrand: 0.38 },
  full: { share: 1, filaments: 38, knots: 110, strand: 2, bridgeStrand: 0.6 },
  max: { share: 1.5, filaments: 38, knots: 110, strand: 3, bridgeStrand: 0.9 },
};
const RING_TEXELS: ByTier<number> = { light: 1024, full: 4096, max: 4096 };
/** The painted sky's counts, as the Orrery's. */
const SKY: ByTier<SkyCounts> = {
  light: { milkyWay: 12_000, fieldStars: 900 },
  full: { milkyWay: 30_000, fieldStars: 1_600 },
  max: { milkyWay: 45_000, fieldStars: 2_400 },
};

export function voyageQuality(quality: RenderQuality, tight: boolean): VoyageQuality {
  const space = spaceQuality(quality, tight);
  const { tier } = space;
  return {
    ...space,
    globe: GLOBE[tier],
    maps: tier === "max" && tight ? TIGHT_MAX_MAPS : MAPS[tier],
    occluders: OCCLUDERS[tier],
    ringTexels: RING_TEXELS[tier],
    cosmos: COSMOS[tier],
    sky: SKY[tier],
  };
}
