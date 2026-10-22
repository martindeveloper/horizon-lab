/**
 * What each render quality means for the Sun lab, on top of the space scenes' share (bloom
 * chain and lens star): its resolution, the surface's fine work, the cut's plume octaves, the
 * prominence march, how many field lines are drawn and how finely, the atmosphere's march and
 * whether spicules are drawn. Standard is the showcase on a desktop; Economy holds 48 fps on a
 * phone. The engine maps the level once and hands each layer its numbers.
 */
import { spaceQuality, type BloomChain, type LensChain } from "@/space/quality";
import { SUN_ACTIVITY_MAX_STEPS } from "@/space/sun/graphics/prominence/parameters";
import type { MapTier } from "@horizon/toolkit/bodies";
import type { RenderQuality } from "@horizon/toolkit/rendering";
import type { SceneResolution } from "@horizon/toolkit/scene";

export type SunQuality = {
  resolution: SceneResolution;
  /** Granules, penumbral filaments, umbral dots and spicule threads at their own scale. */
  fineSurface: boolean;
  /** Noise octaves of the convection zone's plumes on the cut face. */
  cutPlumes: number;
  /** Ray-march steps through a prominence's bound. */
  prominenceSteps: number;
  /** Field lines drawn at most. */
  fieldLines: number;
  /** Points a ribbon is drawn with at most. */
  ribbonSegments: number;
  /** Ray-march samples through the ejection's shell and the loops' glow. */
  coronaSamples: number;
  spicules: boolean;
  /** The measured map's tier drawn near the surface (`far` always loads first). */
  mapTier: MapTier;
  bloom: BloomChain;
  lens: LensChain;
};

type Budget = Omit<SunQuality, "resolution" | "bloom" | "lens" | "mapTier">;

const ECONOMY: Budget = {
  fineSurface: false,
  cutPlumes: 2,
  prominenceSteps: 20,
  fieldLines: 24,
  ribbonSegments: 24,
  coronaSamples: 8,
  spicules: false,
};
const STANDARD: Budget = {
  fineSurface: true,
  cutPlumes: 4,
  prominenceSteps: 40,
  fieldLines: 64,
  ribbonSegments: 48,
  coronaSamples: 20,
  spicules: true,
};
/** A phone at Standard keeps the showcase's look with a lighter march. */
const STANDARD_TIGHT: Budget = { ...STANDARD, prominenceSteps: 28, coronaSamples: 12 };
const CINEMA: Budget = {
  fineSurface: true,
  cutPlumes: 6,
  prominenceSteps: 48,
  fieldLines: 128,
  ribbonSegments: 64,
  coronaSamples: 32,
  spicules: true,
};
const MAX: Budget = {
  fineSurface: true,
  cutPlumes: 8,
  prominenceSteps: SUN_ACTIVITY_MAX_STEPS,
  fieldLines: 256,
  ribbonSegments: 96,
  coronaSamples: 48,
  spicules: true,
};

/** Economy draws at 1 px per CSS px and 48 fps everywhere; Standard is the host's default; Cinematic and Max lift the caps. */
function resolution(quality: RenderQuality, tight: boolean): SceneResolution {
  if (quality === "economy") return { dprCap: 1, fps: 48 };
  if (quality === "standard")
    return tight ? { dprCap: 1.25, fps: 48 } : { dprCap: 1.5, fps: Infinity };
  if (quality === "cinema") return tight ? { dprCap: 1.5, fps: 48 } : { dprCap: 2, fps: Infinity };
  return { dprCap: tight ? 2 : 3, fps: Infinity };
}

export function sunQuality(quality: RenderQuality, tight: boolean): SunQuality {
  const { bloom, lens } = spaceQuality(quality, tight);
  const budget =
    quality === "economy"
      ? ECONOMY
      : quality === "standard"
        ? tight
          ? STANDARD_TIGHT
          : STANDARD
        : quality === "cinema"
          ? CINEMA
          : MAX;
  const mapTier: MapTier =
    quality === "economy" ? "far" : tight && quality !== "max" ? "nearLight" : "near";
  return { ...budget, resolution: resolution(quality, tight), bloom, lens, mapTier };
}
