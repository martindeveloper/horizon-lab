/**
 * Which tier of a measured map a globe needs, from how large it is on screen. An
 * equirectangular map `W` texels wide spreads 2πR of surface over `W` texels; at the centre
 * of a disc `r` device pixels in radius one pixel covers R / r of surface, so the map stops
 * being enough for a texel per pixel once r exceeds W / 2π: 163 pixels for a 1024 map, 326
 * for 2048, 652 for 4096. The scenes' budgets load the smallest tier that is enough and never
 * a larger one than they are allowed.
 */
import type { MapTier } from "@horizon/toolkit/bodies";

/** The tiers from smallest to largest. */
export const TIERS: readonly MapTier[] = ["far", "nearLight", "near"];

export const tierRank = (tier: MapTier) => TIERS.indexOf(tier);

/** The map width that gives one texel per device pixel at the centre of a disc `rPx` pixels in radius. */
export const widthFor = (rPx: number) => 2 * Math.PI * rPx;

/**
 * The smallest tier whose width is enough for a globe `rPx` device pixels in radius, up to
 * `allow`; `allow` itself when none is. Tiers of equal width are one file (`tierFile`), so
 * the smaller name wins.
 */
export function tierFor(rPx: number, widths: Readonly<Record<MapTier, number>>, allow: MapTier) {
  const needed = widthFor(rPx);
  let chosen = allow;
  for (let i = 0; i <= tierRank(allow); i += 1) {
    const tier = TIERS[i]!;
    if (widths[tier] >= needed) {
      chosen = tier;
      break;
    }
  }
  return TIERS.find((tier) => widths[tier] === widths[chosen])!;
}

/** GPU bytes of a map `width` texels wide with its mip chain (RGBA, height half the width). */
export const bytesOf = (width: number) => ((width * width * 4) / 2) * (4 / 3);
