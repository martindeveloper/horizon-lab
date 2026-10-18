/** The formation timeline and the model's clocks, as the notes, tour and technical prose quote them. */
import type { Facts } from "@/lib/facts";
import {
  CLEAR_DONE,
  GAS_DISK_LIFETIME,
  MODEL_START,
  SNOW_LINE_AU,
  SUN_BIRTH,
} from "@/space/solar-system/model/parameters";

import {
  EMBRYOS_AFTER,
  LHB_CLASSIC,
  NAMED_STARS_FADE,
  OLDEST,
  PLANETESIMALS_AFTER,
  THIN_DISK_ERA,
} from "../parameters";

export const TIMELINE = {
  formation: {
    firstSolids: {
      value: SUN_BIRTH,
      unit: "yr",
      show: "Gyr",
      digits: 4,
      source: "connelly2012",
      status: "verified",
      note: "CAIs 4,567.3 ± 0.16 Myr",
    },
    gasDisk: {
      value: GAS_DISK_LIFETIME,
      unit: "yr",
      show: "Myr",
      source: "diskLifetimes",
      status: "teaching-choice",
      note: "inside the observed 3–10 Myr",
    },
    diskLifetimes: {
      range: [3e6, 10e6],
      unit: "yr",
      show: "Myr",
      source: "diskLifetimes",
      status: "verified",
    },
    planetesimals: {
      value: PLANETESIMALS_AFTER,
      unit: "yr",
      show: "kyr",
      source: "horizon",
      status: "flag",
      note: "consistent with reviews; no primary text opened",
    },
    embryos: {
      value: EMBRYOS_AFTER,
      unit: "yr",
      show: "Myr",
      source: "kokubo1998",
      status: "flag",
      note: "citation confirmed; text paywalled",
    },
    snowLine: {
      value: SNOW_LINE_AU,
      unit: "au",
      show: "au",
      source: "lecar2006",
      status: "teaching-choice",
      note: "drawn at 3 au",
    },
    snowLineEstimates: {
      range: [2, 4],
      unit: "au",
      show: "au",
      source: "lecar2006",
      status: "verified",
      note: "from under 2 to about 4 au in the young disk",
    },
    moonImpact: {
      range: [4.35e9, 4.51e9],
      unit: "yr",
      show: "Gyr",
      source: "barboni2017",
      status: "verified",
    },
    lateHeavyBombardment: {
      value: LHB_CLASSIC,
      unit: "yr",
      show: "Gyr",
      source: "lhb",
      status: "verified",
    },
    modelStart: {
      value: MODEL_START,
      unit: "yr",
      show: "Gyr",
      source: "horizon",
      status: "teaching-choice",
      note: "the gas is gone and the giants have formed",
    },
    clearingDone: {
      value: CLEAR_DONE,
      unit: "yr",
      show: "Gyr",
      digits: 3,
      source: "avdellidou2024",
      status: "teaching-choice",
      note: "the drawn clearing runs 67–117 Myr after the CAIs, steepest at 92 Myr, inside the dated 60–100 Myr window",
    },
  },
  clocks: {
    oldest: {
      value: OLDEST,
      unit: "yr",
      show: "Gyr",
      source: "horizon",
      status: "teaching-choice",
      note: "the timeline's far end",
    },
    thinDisk: {
      value: THIN_DISK_ERA,
      unit: "yr",
      show: "Gyr",
      source: "sanders2024",
      status: "verified",
      note: "thin disk and bar in place",
    },
    namedStarsFade: {
      value: NAMED_STARS_FADE,
      unit: "yr",
      source: "horizon",
      status: "teaching-choice",
      note: "proper motions scramble the constellations",
    },
    /** The Gaia-Enceladus merger the timeline's notes date. */
    merger: {
      value: 10,
      unit: "Gyr",
      range: [8, 11],
      source: "gaiaEnceladus",
      status: "verified",
    },
  },
} satisfies Record<string, Facts>;
