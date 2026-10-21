import type { CosmosDetail } from "@/space/cosmos/graphics/cosmos";
import { spaceQuality, type ByTier, type SpaceQuality } from "@/space/quality";
/**
 * What each render quality means for Deep Field, on top of the space scenes' share
 * (`spaceQuality`: resolution and the solar system's swarms). The engine maps the visitor's
 * level here once and hands each layer its part; no layer reads the level or the device class.
 */
import type { RenderQuality } from "@horizon/toolkit/rendering";

type DeepFieldQuality = SpaceQuality & { cosmos: CosmosDetail };

/** Max keeps the web's structure and samples it half as densely again. */
const COSMOS: ByTier<CosmosDetail> = {
  light: { share: 0.6, filaments: 26, knots: 70, strand: 1.2, bridgeStrand: 0.38 },
  full: { share: 1, filaments: 38, knots: 110, strand: 2, bridgeStrand: 0.6 },
  max: { share: 1.5, filaments: 38, knots: 110, strand: 3, bridgeStrand: 0.9 },
};

export function deepFieldQuality(quality: RenderQuality, tight: boolean): DeepFieldQuality {
  const space = spaceQuality(quality, tight);
  return { ...space, cosmos: COSMOS[space.tier] };
}
