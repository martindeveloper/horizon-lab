import { cssColor, encodeSrgb, hellandBlackbodyLinear } from "@horizon/toolkit/science";

import { radiusMetres } from "../lib/model/catalogue";
import { LOOKS, type Look } from "../lib/model/looks";
import { RUNGS, RUNG_IDS } from "../lib/model/rungs";
import { BROWN_DWARF_ALKALI } from "../lib/parameters";

export const LOG_RADII = RUNG_IDS.map((id) => Math.log10(radiusMetres(id).radius));
const LOG_LOW = Math.min(...LOG_RADII);
const LOG_HIGH = Math.max(...LOG_RADII);

/**
 * The colour of a body's own light as the stage paints it: a blackbody (`hellandBlackbody`, the
 * shader's `blackbody`) at the temperature its face is drawn at, the display one where none is
 * catalogued (a pulsar's, a brown dwarf's, through its alkali lines); none for a planet or a
 * horizon, which shine by no light of their own.
 */
function lightOf(look: Look) {
  if (look.style === "earth" || look.style === "jupiter" || look.style === "horizon") return;
  const [r, g, b] = hellandBlackbodyLinear((look.equatorK + look.poleK) / 2);
  const [tr, tg, tb] = look.style === "brownDwarf" ? BROWN_DWARF_ALKALI : [1, 1, 1];
  return cssColor([encodeSrgb(r * tr), encodeSrgb(g * tg), encodeSrgb(b * tb)]);
}

/**
 * Each body as the ladder marks it, in the strip and the list: its size as a share of the
 * ladder's span on a log scale (0 the smallest, 1 the largest) and the colour of its light.
 */
export const LADDER_DOTS = RUNGS.map((rung, index) => ({
  id: rung.id,
  kind: rung.kind,
  share: (LOG_RADII[index]! - LOG_LOW) / (LOG_HIGH - LOG_LOW),
  colour: lightOf(LOOKS[index]!),
}));

/** A dot's diameter, px, between the smallest body's and the largest's. */
export const dotPx = (share: number, [low, high]: readonly [number, number]) =>
  low + share * (high - low);
