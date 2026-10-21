import type { RungId } from "./rungs";

/**
 * The guided climb: the Sun as the ruler, down to the dead stars smaller than Earth, back up
 * through the giants with the planets' orbits round them, the heaviest star, and past every
 * star to the black holes' horizons. Each step flies to its rung; `orbits` shows the planets'
 * orbits about it, `equation` names a formula the caption prints (`GIANTS_EQUATIONS`) and
 * `figure` a catalogue figure it quotes (`components/guide.tsx`).
 */
export type TourStep = {
  id: string;
  rung: RungId;
  orbits?: boolean;
  equation?: string;
  figure?: "earths" | "density" | "orbit" | "luminosity" | "radius";
  /** Seconds the step holds once landed before a playing guide moves on. */
  dwell?: number;
};

/** A step's hold when it sets none: time to read a caption and look. */
export const GUIDE_DWELL = 12;

export const TOUR: readonly TourStep[] = [
  { id: "ruler", rung: "sun", figure: "earths" },
  { id: "dwarf", rung: "sirius-b", figure: "density", equation: "mean-density" },
  { id: "pulsar", rung: "neutron-star", figure: "radius" },
  { id: "giants", rung: "betelgeuse", orbits: true, figure: "orbit", equation: "light-lap" },
  { id: "heavy", rung: "r136a1", figure: "luminosity", equation: "stefan-boltzmann" },
  { id: "horizons", rung: "m87", orbits: true, equation: "schwarzschild-radius" },
];
