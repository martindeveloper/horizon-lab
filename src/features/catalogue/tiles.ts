import type { SimulationManifest } from "@/lib/simulation-types";
import { TILT_TRAVEL } from "@horizon/toolkit/ui";

/**
 * The copy's parallax layers for `Tilt`, in front of the art's own (`artLayers`), up to the play
 * disc nearest the eye. Nested layers add up: the title rides its panel, the play disc its copy.
 */
export const TILE_DEPTH = {
  category: 0.4,
  plate: 1,
  panel: 0.5,
  title: 0.4,
  copy: 0.5,
  play: 0.8,
} as const;

/** The far plane, where a flat artwork sits whole. */
const FAR = -1;

/**
 * A tile's art as `Tilt` layers in paint order. Each layer is the same SVG under its fragment,
 * which shows only that layer, so the stack rebuilds the picture at rest.
 */
export function artLayers({ artwork, artworkLayers }: SimulationManifest) {
  return (
    artworkLayers?.map(({ id, depth }) => ({ src: `${artwork}#layer-${id}`, depth })) ?? [
      { src: artwork, depth: FAR },
    ]
  );
}

/** The art overhangs the tile by more than its deepest layer travels, so no edge shows. */
export function artBleed(layers: readonly { depth: number }[]) {
  return Math.max(...layers.map(({ depth }) => Math.abs(depth))) * TILT_TRAVEL + 4;
}

/**
 * The catalogue's bento tiles, shared by the page and its loading skeleton so both keep one
 * geometry: a tall rounded frame, and pairs of tiles that alternate 7/5 and 5/7 on wide screens
 * (6/6 on laptops); a lone last tile spans the row. Phones stack full-bleed tiles.
 */
export const TILE_FRAME =
  "min-h-[38rem] rounded-3xl sm:min-h-[42rem] lg:h-[clamp(38rem,48vw,46rem)] lg:min-h-0";

/** An experience's tile: the same frame, shorter, with its copy on the scene, on the second shelf. */
export const EXPERIENCE_FRAME =
  "min-h-[30rem] rounded-3xl sm:min-h-[32rem] lg:h-[clamp(28rem,34vw,34rem)] lg:min-h-0";

export function tileSpan(index: number, count: number) {
  if (count % 2 === 1 && index === count - 1) return "lg:col-span-12";
  const wideFirst = Math.floor(index / 2) % 2 === 0;
  return (index % 2 === 0) === wideFirst
    ? "lg:col-span-6 xl:col-span-7"
    : "lg:col-span-6 xl:col-span-5";
}
