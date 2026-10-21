/**
 * What the render settings mean for Giants' one shader pass: the quality caps its pixels and
 * whether the finer companions of the stars' layers are drawn (a second octave of threads and
 * rays, the spicules), and sizes the bloom chain when bloom is on. The engine reads these
 * rules; nothing else picks numbers by level.
 */
import type { BloomSettings, PassAntialias, RenderQuality } from "@horizon/toolkit/rendering";

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

/** Bloom on the stars' discs: soft light round the brightest surfaces only. */
export function bloomSettings(quality: RenderQuality): BloomSettings {
  return {
    // This pass blooms display-referred light. A broad, strong shoulder adds enough
    // light to clip entire stellar faces, erasing the resolved temperature structure.
    strength: 0.16,
    threshold: 0.94,
    knee: 0.08,
    clamp: 2,
    mips: quality === "economy" ? 4 : 5,
    scale: quality === "economy" ? 0.25 : 0.5,
  };
}
