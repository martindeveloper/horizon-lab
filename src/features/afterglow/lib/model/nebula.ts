/**
 * The planetary nebula as seen from inside its shell: how much the cast-off gas glows at an
 * age. An illustration, not a radiative model: the shell lights once the bare core is hot
 * enough to ionise it, and thins away as it expands, on a clock of the chapter's own.
 */
import { smoothstep } from "@horizon/toolkit/math";

import { NEBULA_FADE_YEARS, NEBULA_IONISED_K } from "./parameters";
import { AGB_END } from "./track";

/** The glow's strength, 0–1, at an age and the core's temperature then. */
export function nebulaGlow(age: number, teff: number) {
  if (age < AGB_END) return 0;
  const ionised = smoothstep(NEBULA_IONISED_K[0], NEBULA_IONISED_K[1], teff);
  return ionised * Math.exp(-(age - AGB_END) / NEBULA_FADE_YEARS);
}
