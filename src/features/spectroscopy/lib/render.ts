import type { RenderQuality } from "@horizon/toolkit/rendering";

/** The browser always smooths a 2D canvas; `supersample` (SSAA) draws it at twice the pixels as well. */
export type CanvasAntialias = "off" | "supersample";

/**
 * Pixels per CSS pixel the quality allows: the device's, capped (economy 1, standard 2,
 * cinema 3, max 4). The spectrum is computed at this many samples per CSS pixel, so
 * anti-aliasing never changes the lines it shows.
 */
export function qualityScale(dpr: number, quality: RenderQuality) {
  const cap = { economy: 1, standard: 2, cinema: 3, max: 4 }[quality];
  return Math.min(cap, dpr > 0 ? dpr : 1);
}

/** A drawn canvas's pixels per CSS pixel: `qualityScale`, doubled by supersampling, never past 4. */
export function canvasScale(dpr: number, quality: RenderQuality, antialias: CanvasAntialias) {
  const base = qualityScale(dpr, quality);
  return antialias === "supersample" ? Math.min(4, base * 2) : base;
}
