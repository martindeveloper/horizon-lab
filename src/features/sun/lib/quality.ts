/**
 * What each render quality means for the Sun lab, on top of the space scenes' share (bloom
 * chain and lens star): its resolution, the surface's fine work, the cut's plume octaves, the
 * prominence march, how many field lines are drawn and how finely, the atmosphere's march and
 * whether spicules are drawn. Standard is the showcase on a desktop; Economy holds 48 fps on a
 * phone. The engine maps the level once and hands each layer its numbers.
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
  /** The sky's point counts: the Milky Way's grains and the faint field stars. */
  sky: SkyCounts;
  /** The measured map's tier drawn near the surface (`far` always loads first). */
  mapTier: MapTier;
  bloom: BloomChain;
  lens: LensChain;
};

type Budget = Omit<SunQuality, "resolution" | "bloom" | "lens" | "mapTier">;

/** The sky's counts by tier, the Orrery's. */
const SKY_LIGHT: SkyCounts = { milkyWay: 12_000, fieldStars: 900 };
const SKY_FULL: SkyCounts = { milkyWay: 30_000, fieldStars: 1_600 };
const SKY_MAX: SkyCounts = { milkyWay: 45_000, fieldStars: 2_400 };

const ECONOMY: Budget = {
  fineSurface: false,
  cutPlumes: 2,
  prominenceSteps: 20,
  fieldLines: 24,
  ribbonSegments: 24,
  coronaSamples: 8,
  spicules: false,
  sky: SKY_LIGHT,
};
const STANDARD: Budget = {
  fineSurface: true,
  cutPlumes: 4,
  prominenceSteps: 40,
  fieldLines: 64,
  ribbonSegments: 48,
  coronaSamples: 20,
  spicules: true,
  sky: SKY_FULL,
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
  sky: SKY_MAX,
};
const MAX: Budget = {
  fineSurface: true,
  cutPlumes: 8,
  prominenceSteps: SUN_ACTIVITY_MAX_STEPS,
  fieldLines: 256,
  ribbonSegments: 96,
  coronaSamples: 48,
  spicules: true,
  sky: SKY_MAX,
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
