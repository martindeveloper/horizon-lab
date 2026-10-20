import {
  cieObserver,
  displayColor,
  planckRadiance,
  type Gamut,
  type Rgb,
} from "@horizon/toolkit/science";

import { absorbedWidth, slabProfiles, type Observation } from "./spectrum";

/** What a glowing gas looks like: its colour in `gamut` and how bright, 0..1. */
export type Glow = { rgb: Rgb; level: number };

/**
 * The light a slab of gas gives off on its own, for the flame's glow: each line's Planck
 * radiance over the width it absorbs, summed through the CIE observer into a colour. A dim
 * flame still shows; a bright one saturates. Null for a star or a gas with no lines.
 */
export function glowOf(obs: Observation, gamut: Gamut): Glow | null {
  if (obs.kind !== "slab") return null;
  const lines = slabProfiles(obs);
  if (lines.length === 0) return null;
  let X = 0;
  let Y = 0;
  let Z = 0;
  for (const { line, profile } of lines) {
    const power = planckRadiance(line.wavelength, obs.gas.temperature) * absorbedWidth(profile);
    const [x, y, z] = cieObserver(line.wavelength);
    X += power * x;
    Y += power * y;
    Z += power * z;
  }
  if (!(Y > 0) && !(X > 0)) return null;
  const reference = planckRadiance(555, obs.gas.temperature) * 0.05;
  return {
    rgb: displayColor([X, Y, Z], gamut),
    level: Math.min(1, 0.25 + Math.log10(1 + (X + Y + Z) / reference) / 3),
  };
}
