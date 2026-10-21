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
