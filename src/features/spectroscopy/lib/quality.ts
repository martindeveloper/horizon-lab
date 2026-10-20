/**
 * What the render settings mean for Spectra's two 2D canvases (the scene and the ribbon): the
 * quality caps their pixels, 2× supersampling doubles them, and wide colour draws spectral hues
 * in Display P3 where the screen and browser can show it. Components read these rules; none
 * picks numbers by level itself.
 */
import type { RenderQuality } from "@horizon/toolkit/rendering";
import type { Gamut } from "@horizon/toolkit/science";

/** The browser always smooths a 2D canvas; `supersample` draws it at twice the pixels as well. */
export type CanvasAntialias = "off" | "supersample";

/** Canvas pixels per CSS pixel at most, at each quality. */
const PIXEL_CAP: Readonly<Record<RenderQuality, number>> = {
  economy: 1,
  standard: 2,
  cinema: 3,
  max: 4,
};

/**
 * Frames a second the flying photons draw at, at most. The scene only stamps its still layer
 * and a few dozen streaks, so every level but Economy keeps up with a 60 Hz screen.
 */
export const SCENE_FPS: Readonly<Record<RenderQuality, number>> = {
  economy: 30,
  standard: 60,
  cinema: 60,
  max: 60,
};

/** Supersampling never takes a canvas past this many pixels per CSS pixel. */
const MOST_PIXELS = 4;

/**
 * Pixels per CSS pixel the quality allows: the device's, capped. The spectrum is computed at
 * this many samples per CSS pixel, so anti-aliasing never changes the lines it shows.
 */
export function qualityScale(dpr: number, quality: RenderQuality) {
  return Math.min(PIXEL_CAP[quality], dpr > 0 ? dpr : 1);
}

/** A drawn canvas's pixels per CSS pixel: `qualityScale`, doubled by supersampling. */
export function canvasScale(dpr: number, quality: RenderQuality, antialias: CanvasAntialias) {
  const base = qualityScale(dpr, quality);
  return antialias === "supersample" ? Math.min(MOST_PIXELS, base * 2) : base;
}

/** The gamut to draw in: P3 when the visitor asked for wide colour and the screen shows it. */
export function drawingGamut(wide: boolean, screenP3: boolean): Gamut {
  return wide && screenP3 ? "p3" : "srgb";
}

/**
 * A canvas's 2D context in `gamut`. A canvas keeps the colour space of its first context, so
 * give each gamut its own canvas element.
 */
export function context2d(canvas: HTMLCanvasElement, gamut: Gamut) {
  return canvas.getContext("2d", { colorSpace: gamut === "p3" ? "display-p3" : "srgb" });
}

let p3Canvas: boolean | undefined;
/** Whether this browser's 2D canvases draw in Display P3 when asked; checked once. */
export function canvasShowsP3() {
  p3Canvas ??=
    context2d(document.createElement("canvas"), "p3")?.getContextAttributes().colorSpace ===
    "display-p3";
  return p3Canvas;
}
