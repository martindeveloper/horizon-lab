/**
 * What the render settings mean for Giants' one shader pass: the quality caps its pixels and
 * whether the finer companions of the stars' layers are drawn (a second octave of threads and
 * rays, the spicules), and sizes the bloom chain when bloom is on. The engine reads these
 * rules; nothing else picks numbers by level.
 */
import type { BloomSettings, PassAntialias, RenderQuality } from "@horizon/toolkit/rendering";

import { EXPOSURE } from "./parameters";

/** The modes the pass can draw: the discs' edges are smoothed in the shader already. */
export type GiantsAntialias = Extract<PassAntialias, "off" | "fxaa">;

type Level = {
  /** Device pixels per CSS pixel at most. */
  dprCap: number;
  /** Share of those pixels drawn. */
  scale: number;
  /** The layers' finer companions: off on economy. */
  detail: boolean;
  /** Focused surface only: economy ½, standard 1, cinema/max add the finest layer. */
  surfaceDetail: number;
  /** Frames a second while the camera moves. */
  fps: number;
};

export const GIANTS_QUALITY: Readonly<Record<RenderQuality, Level>> = {
  economy: { dprCap: 1, scale: 0.75, detail: false, surfaceDetail: 0.5, fps: 30 },
  standard: { dprCap: 2, scale: 1, detail: true, surfaceDetail: 1, fps: 60 },
  cinema: { dprCap: 2, scale: 1, detail: true, surfaceDetail: 2, fps: 60 },
  max: { dprCap: 4, scale: 1, detail: true, surfaceDetail: 2, fps: 60 },
};

/**
 * Bloom on the stars' radiance, before the tone curve, in the curve's units (radiance times
 * its exposure): light the curve shows near white (about twice its shoulder) glows, eased in
 * over a knee below it, a pixel counting at most `clamp`. The glow is added `strength` times and
 * goes through the curve with the face, so it rolls off as the face does; a lower threshold
 * blooms whole faces and erases their temperature structure.
 */
export const GIANTS_BLOOM = { strength: 0.16, threshold: 1.3, knee: 0.3, clamp: 4 } as const;

/**
 * The same look where the GPU cannot render half-float and the pass blooms the display frame:
 * display values, at most white, above 0.94 of it glowing.
 */
const DISPLAY_BLOOM = { strength: 0.16, threshold: 0.94, knee: 0.08, clamp: 2 } as const;

/**
 * Bloom on the stars' discs: soft light round the brightest surfaces only, on radiance where
 * the pass has it (`radiance`, the pass's `hdr`), else on the display frame.
 */
export function bloomSettings(quality: RenderQuality, radiance: boolean): BloomSettings {
  const look = radiance
    ? {
        strength: GIANTS_BLOOM.strength,
        threshold: GIANTS_BLOOM.threshold / EXPOSURE,
        knee: GIANTS_BLOOM.knee / EXPOSURE,
        clamp: GIANTS_BLOOM.clamp / EXPOSURE,
      }
    : DISPLAY_BLOOM;
  return {
    ...look,
    mips: quality === "economy" ? 4 : 5,
    scale: quality === "economy" ? 0.25 : 0.5,
  };
}
