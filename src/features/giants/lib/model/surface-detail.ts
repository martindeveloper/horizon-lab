import type { RenderQuality } from "@horizon/toolkit/rendering/quality";

import { GIANTS_QUALITY } from "../quality";
import { weatherShown, type WeatherFade } from "./weather-fade";

/** One surface owns the expensive layers, independent of whether it has magnetic weather. */
export function surfaceDetail(index: number, focus: WeatherFade, quality: RenderQuality) {
  return index === focus.star
    ? weatherShown(focus.level) * GIANTS_QUALITY[quality].surfaceDetail
    : 0;
}
