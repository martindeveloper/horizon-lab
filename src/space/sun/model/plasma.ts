/**
 * Two plasma figures the eruption's notes quote: how fast a disturbance runs along the field,
 * and how much energy a volume of field stores for reconnection to release.
 */
import { VACUUM_PERMEABILITY } from "@horizon/toolkit/science";

/** The Alfvén speed of a field `tesla` in plasma of density `rhoKgM3`, m/s: v_A = B / √(μ₀ ρ). */
export const alfvenSpeed = (tesla: number, rhoKgM3: number) =>
  tesla / Math.sqrt(VACUUM_PERMEABILITY * rhoKgM3);

/** The magnetic energy of a field `tesla` filling `volumeM3`, J: B²/(2μ₀) × V. */
export const magneticEnergy = (tesla: number, volumeM3: number) =>
  ((tesla * tesla) / (2 * VACUUM_PERMEABILITY)) * volumeM3;
