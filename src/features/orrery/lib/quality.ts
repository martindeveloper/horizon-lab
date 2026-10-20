import { spaceQuality, type ByTier, type SpaceQuality } from "@/space/quality";
/**
 * What each render quality means for the Orrery, on top of the space scenes' share
 * (`spaceQuality`: resolution and swarms). The engine maps the visitor's level here once and
 * hands each layer its part; no layer reads the level or the device class itself.
 */
import type { RenderQuality } from "@horizon/toolkit/rendering";

import { SUN_ACTIVITY_MAX_STEPS } from "./model/solar-activity";

/** The sky's point counts: the Milky Way's resolved grains and the faint field stars. */
export type SkyCounts = { milkyWay: number; fieldStars: number };

/** Far measured maps: bytes kept resident, and texture filtering at grazing angles. */
export type MapQuality = { budget: number; anisotropy: number };

/** Close-ups: the lighter near map tier and painted detail, their filtering, and the atmosphere shell's samples. */
export type CloseUpQuality = { light: boolean; anisotropy: number; airSteps: number };

type OrreryQuality = SpaceQuality & {
  sky: SkyCounts;
  maps: MapQuality;
  closeUp: CloseUpQuality;
  /** Ray-march steps through the Sun's prominences. */
  activitySteps: number;
};

const SKY: ByTier<SkyCounts> = {
  light: { milkyWay: 12_000, fieldStars: 900 },
  full: { milkyWay: 30_000, fieldStars: 1_600 },
  max: { milkyWay: 45_000, fieldStars: 2_400 },
};

const MAPS: ByTier<MapQuality> = {
  light: { budget: 24e6, anisotropy: 2 },
  full: { budget: 64e6, anisotropy: 2 },
  max: { budget: 128e6, anisotropy: 16 },
};

/** The atmosphere shell marches 6, 12 or 20 samples along each view ray; it draws at every level. */
const CLOSE_UP: ByTier<CloseUpQuality> = {
  light: { light: true, anisotropy: 4, airSteps: 6 },
  full: { light: false, anisotropy: 4, airSteps: 12 },
  max: { light: false, anisotropy: 16, airSteps: 20 },
};

const ACTIVITY_STEPS: ByTier<number> = {
  light: 20,
  full: SUN_ACTIVITY_MAX_STEPS,
  max: SUN_ACTIVITY_MAX_STEPS,
};

/** Max keeps a low-memory device's resident maps to the desktop budget, filtered as sharply. */
const TIGHT_MAX_MAPS: MapQuality = { budget: MAPS.full.budget, anisotropy: MAPS.max.anisotropy };

export function orreryQuality(quality: RenderQuality, tight: boolean): OrreryQuality {
  const space = spaceQuality(quality, tight);
  const { tier } = space;
  return {
    ...space,
    sky: SKY[tier],
    maps: tier === "max" && tight ? TIGHT_MAX_MAPS : MAPS[tier],
    closeUp: CLOSE_UP[tier],
    activitySteps: ACTIVITY_STEPS[tier],
  };
}
