/**
 * What each render quality means for the Sun lab, on top of the space scenes' share (bloom
 * chain and lens star): its resolution, the surface's fine work, the cut's plume octaves, the
 * prominence march, how many field lines are drawn and how finely, the atmosphere's march and
 * whether spicules are drawn. Standard is the showcase on a desktop; Economy is the lightest
 * look at every space scene's Economy resolution. The resolution and the sky are every space
 * scene's (`spaceQuality`). The engine maps the level once and hands each layer its numbers.
 */
import { spaceQuality, type BloomChain, type LensChain } from "@/space/quality";
import type { SkyCounts } from "@/space/sky/milky-way";
import { SUN_ACTIVITY_MAX_STEPS } from "@/space/sun/graphics/prominence/parameters";
import type { MapTier } from "@horizon/toolkit/bodies";
import type { RenderQuality } from "@horizon/toolkit/rendering";
import type { SceneResolution } from "@horizon/toolkit/scene";

export type SunQuality = {
  resolution: SceneResolution;
  /** Granules, penumbral filaments, umbral dots and spicule threads at their own scale. */
  fineSurface: boolean;
  /** Ray-march steps through a prominence's bound. */
  prominenceSteps: number;
  /** Field lines drawn at most. */
  fieldLines: number;
  /** Points a ribbon is drawn with at most. */
  ribbonSegments: number;
  /** Ray-march samples through the ejection's shell and the loops' glow. */
  coronaSamples: number;
  spicules: boolean;
  /** The sky's point counts: the Milky Way's grains and the faint field stars. */
  sky: SkyCounts;
  /** The measured map's tier drawn near the surface (`far` always loads first). */
  mapTier: MapTier;
  bloom: BloomChain;
  lens: LensChain;
};

type Budget = Omit<SunQuality, "resolution" | "bloom" | "lens" | "mapTier" | "sky">;

const ECONOMY: Budget = {
  fineSurface: false,
  prominenceSteps: 20,
  fieldLines: 24,
  ribbonSegments: 24,
  coronaSamples: 8,
  spicules: false,
};
const STANDARD: Budget = {
  fineSurface: true,
  prominenceSteps: 40,
  fieldLines: 64,
  ribbonSegments: 48,
  coronaSamples: 32,
  spicules: true,
};
/** A phone at Standard keeps the showcase's look with a lighter march. */
const STANDARD_TIGHT: Budget = { ...STANDARD, prominenceSteps: 28, coronaSamples: 16 };
const CINEMA: Budget = {
  fineSurface: true,
  prominenceSteps: 48,
  fieldLines: 128,
  ribbonSegments: 64,
  coronaSamples: 32,
  spicules: true,
};
const MAX: Budget = {
  fineSurface: true,
  prominenceSteps: SUN_ACTIVITY_MAX_STEPS,
  fieldLines: 256,
  ribbonSegments: 96,
  coronaSamples: 48,
  spicules: true,
};

const BUDGETS: Record<RenderQuality, Budget> = {
  economy: ECONOMY,
  standard: STANDARD,
  cinema: CINEMA,
  max: MAX,
};

export function sunQuality(quality: RenderQuality, tight: boolean): SunQuality {
  const { bloom, lens, resolution, sky } = spaceQuality(quality, tight);
  const budget = quality === "standard" && tight ? STANDARD_TIGHT : BUDGETS[quality];
  let mapTier: MapTier = "near";
  if (quality === "economy") {
    mapTier = "far";
  } else if (tight && quality !== "max") {
    mapTier = "nearLight";
  }
  return { ...budget, resolution, sky, bloom, lens, mapTier };
}
