import { includesId } from "@horizon/toolkit/records";

import { custom } from "./custom";
import { gaiaBh3 } from "./gaia-bh3";
import { gw231123 } from "./gw231123";
import { kerr } from "./kerr";
import { lensed } from "./lensed";
import { m87 } from "./m87";
import { omegaCen } from "./omega-cen";
import { DEFAULT_PRESET_ID, HOLE_ALIASES, PRESET_IDS, type PresetId } from "./routes";
import { schwarzschild } from "./schwarzschild";
import { sgrA } from "./sgr-a";
import { stellar } from "./stellar";
import { ton618 } from "./ton-618";
import type { HoleSpec } from "./types";

export * from "./types";
export { custom, HOLE_ALIASES };

const BY_ID: Record<PresetId, HoleSpec> = {
  stellar,
  "gaia-bh3": gaiaBh3,
  gw231123,
  "omega-cen": omegaCen,
  "sgr-a": sgrA,
  m87,
  "ton-618": ton618,
  lensed,
  schwarzschild,
  kerr,
};

/** Observatory presets, in the picker's order (`routes.ts`). */
export const PRESETS: HoleSpec[] = PRESET_IDS.map((id) => BY_ID[id]);

export const DEFAULT_PRESET: HoleSpec = BY_ID[DEFAULT_PRESET_ID];

export function holeById(id: string): HoleSpec {
  return includesId(PRESET_IDS, id) ? BY_ID[id] : custom;
}
