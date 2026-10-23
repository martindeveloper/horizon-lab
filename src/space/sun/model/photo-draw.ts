/**
 * How each region is drawn from the photograph, so the white-light disc keeps its measured look
 * as the model's weather moves on: a seeded group from its own photographed patch, carried with
 * it; a group the weather grows later from the patch of a photographed group (its donor), scaled
 * to its size and turned. A patch stays where its region is, at its size: as the region's spot
 * area grows or decays, the renderer keeps only the photograph's spots deeper than its share
 * allows, so a group decays from its pores and penumbral rims inward and grows from its darkest
 * cores out. The photograph's spots no slot holds decay as the largest of them would.
 */
import { TAU, clamp01 } from "@horizon/toolkit/math";

import { regionLife, regionStrength, seededDeath } from "./activity";
import type { Region } from "./contract";
import { dice } from "./dice";
import {
  DAY_S,
  OBSERVED_START_SHARE,
  PHOTO_DONOR_MIN_SIZE_SHARE,
  REGION_SLOTS,
} from "./parameters";
import { CARRINGTON_SYNODIC_PERIOD_D } from "./rotation";
import { LARGEST_UNSEEDED, SPOT_GROUPS, seededGroupOf, type SpotGroup } from "./spot-groups";

/** A seeded group's strength at the epoch: what its photographed patch shows. */
const SEEDED_STRENGTH = regionStrength(OBSERVED_START_SHARE);
/** A seeded group lends its face to no grown group born while it is on the disc or within a rotation of its end. */
const DONOR_REST_S = CARRINGTON_SYNODIC_PERIOD_D * DAY_S;
const DONOR_SALT = 911;

export type PhotoDraw = {
  /** The photographed group whose patch is drawn: the region's own when it is seeded. */
  donor: SpotGroup;
  /** Radians of the patch per radian of the region. */
  scale: number;
  /** The region's spot area against its patch's, 0–1: how deep into the photograph's spots it keeps. */
  growth: number;
  /** How far the patch is turned about its centre, radians: none for a seeded group. */
  turn: number;
};

export const blankPhotoDraw = (): PhotoDraw => ({
  donor: SPOT_GROUPS[0]!,
  scale: 1,
  growth: 0,
  turn: 0,
});

/** A group can lend its patch to a region born at `birth`: not a seeded group then on the disc or just gone. */
const lends = (index: number, birth: number) =>
  index >= REGION_SLOTS || birth >= seededDeath(SPOT_GROUPS[index]!) + DONOR_REST_S;

/**
 * The photographed group a grown region borrows, by its id and birth (model seconds): one free
 * to lend and at least nearly its size, else the largest free one.
 */
function donorFor(region: Region, birth: number) {
  let fitting = 0;
  let free = -1;
  for (let i = 0; i < SPOT_GROUPS.length; i++) {
    if (!lends(i, birth)) continue;
    if (free < 0) free = i;
    if (SPOT_GROUPS[i]!.size >= PHOTO_DONOR_MIN_SIZE_SHARE * region.size) fitting++;
  }
  if (fitting === 0) return SPOT_GROUPS[Math.max(0, free)]!;
  let pick = Math.floor(dice(region.id, DONOR_SALT) * fitting);
  for (let i = 0; i < SPOT_GROUPS.length; i++) {
    const group = SPOT_GROUPS[i]!;
    if (!lends(i, birth) || group.size < PHOTO_DONOR_MIN_SIZE_SHARE * region.size) continue;
    if (pick-- === 0) return group;
  }
  return SPOT_GROUPS[free]!;
}

/** How a region is drawn from the photograph at `time` (model seconds from the epoch), into `out`. */
export function photoDrawOf(
  region: Region,
  time: number,
  out: PhotoDraw = blankPhotoDraw(),
): PhotoDraw {
  const own = seededGroupOf(region.id);
  out.donor = own ?? donorFor(region, time - region.age);
  out.scale = out.donor.size / region.size;
  out.growth = clamp01(region.strength / (own ? SEEDED_STRENGTH : 1));
  out.turn = own ? 0 : TAU * dice(region.id, DONOR_SALT, 1);
  return out;
}

/** The life of the largest group no slot holds, seconds: how long the photograph's unclaimed spots last. */
const UNCLAIMED_LIFE = LARGEST_UNSEEDED ? regionLife(LARGEST_UNSEEDED.size) : 0;

/**
 * How much of the photograph's unclaimed spots shows `time` model seconds after the epoch, 0–1:
 * they decay as the largest of them would, from its prime.
 */
export const unclaimedSpotShare = (time: number) =>
  UNCLAIMED_LIFE > 0
    ? clamp01(
        regionStrength(OBSERVED_START_SHARE + Math.max(0, time) / UNCLAIMED_LIFE) / SEEDED_STRENGTH,
      )
    : 0;
