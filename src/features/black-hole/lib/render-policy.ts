import type { Quality } from "./presets";
import { QUALITY_SCALE } from "./presets";

/** Hard work budgets apply even when the browser cannot report battery state. */
export function renderBudget(quality: Quality, constrained: boolean, active: boolean) {
  const pixels = { economy: 600_000, standard: 1_200_000, cinema: 2_400_000 }[quality];
  return {
    pixels: constrained ? Math.min(pixels, 800_000) : pixels,
    dprCap: quality === "cinema" && !constrained ? 1.5 : 1,
    fps: quality === "economy" ? 24 : quality === "cinema" && active && !constrained ? 60 : 30,
  };
}
export function renderScale(
  quality: Quality,
  width: number,
  height: number,
  dpr: number,
  constrained: boolean,
) {
  const budget = renderBudget(quality, constrained, false);
  const density = Math.min(dpr, budget.dprCap);
  return Math.min(
    QUALITY_SCALE[quality],
    Math.sqrt(budget.pixels / Math.max(1, width * height * density * density)),
  );
}

/** Keep the same horizontal framing on portrait screens, matching the toolkit ray-scale convention. */
export function framedRayFov(base: number, aspect: number) {
  return 2 * Math.atan((2 * Math.tan(base / 2)) / Math.min(1, Math.max(0.1, aspect)));
}
