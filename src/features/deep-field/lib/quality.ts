import { COSMOS_DETAIL, type CosmosDetail } from "@/space/cosmos/graphics/cosmos";
import { spaceQuality, type SpaceQuality } from "@/space/quality";
/**
 * What each render quality means for Deep Field, on top of the space scenes' share
 * (`spaceQuality`: resolution and the solar system's swarms). The engine maps the visitor's
 * level here once and hands each layer its part; no layer reads the level or the device class.
 */
import type { RenderQuality } from "@horizon/toolkit/rendering";

type DeepFieldQuality = SpaceQuality & { cosmos: CosmosDetail };

export function deepFieldQuality(quality: RenderQuality, tight: boolean): DeepFieldQuality {
  const space = spaceQuality(quality, tight);
  return { ...space, cosmos: COSMOS_DETAIL[space.tier] };
}
