import { custom } from "./custom";
import { gaiaBh3 } from "./gaia-bh3";
import { gw231123 } from "./gw231123";
import { kerr } from "./kerr";
import { lensed } from "./lensed";
import { m87 } from "./m87";
import { omegaCen } from "./omega-cen";
import { schwarzschild } from "./schwarzschild";
import { sgrA } from "./sgr-a";
import { stellar } from "./stellar";
import { ton618 } from "./ton-618";
import type { HoleSpec } from "./types";

export * from "./types";
export { custom };

/** Observatory presets, picker order: real objects by mass, then theory. */
export const PRESETS: HoleSpec[] = [
  stellar,
  gaiaBh3,
  gw231123,
  omegaCen,
  sgrA,
  m87,
  ton618,
  lensed,
  schwarzschild,
  kerr,
];

export const DEFAULT_PRESET: HoleSpec = lensed;

const BY_ID: Record<string, HoleSpec> = Object.fromEntries(
  [...PRESETS, custom].map((h) => [h.id, h]),
);

export function holeById(id: string): HoleSpec {
  return Object.hasOwn(BY_ID, id) ? BY_ID[id]! : custom;
}

export const HOLE_ALIASES: Record<string, string> = Object.fromEntries(
  [...PRESETS, custom].flatMap((h) => h.aliases.map((a) => [a, h.id])),
);
