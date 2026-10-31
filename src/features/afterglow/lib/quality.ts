/**
 * What each render quality means for Afterglow, on top of the space scenes' share
 * (`spaceQuality`: resolution, bloom and lens chains, the sky's counts). The engine maps the
 * visitor's level here once; no layer reads the level or the device class.
 */
import { spaceQuality, type SpaceQuality } from "@/space/quality";
import type { RenderQuality } from "@horizon/toolkit/rendering";

export type AfterglowQuality = SpaceQuality;

export function afterglowQuality(quality: RenderQuality, tight: boolean): AfterglowQuality {
  return spaceQuality(quality, tight);
}
