import type { ElementId } from "./atoms";
import { BENCH_DEFAULT, type Bench, type Mystery, type StarChoice } from "./scenes";
import type { ViewId } from "./view-ids";

/**
 * The guided journey: continuous light, then a gas that takes some of it, the same gas
 * glowing, hydrogen's ladder, the Sun's dark lines, fingerprints, Earth's own lines, the
 * spectral sequence, and a mystery to solve. Each step sets the bench or the sky it needs;
 * `equation` names a formula the caption prints (`SPECTROSCOPY_EQUATIONS`).
 */
export type TourStep = {
  id: string;
  view: ViewId;
  bench?: Bench;
  star?: StarChoice;
  velocity?: number;
  air?: boolean;
  letters?: boolean;
  mystery?: Mystery;
  compare?: readonly ElementId[];
  /** The wavelength window, nm. */
  range?: readonly [number, number];
  /** A line to open, by id. */
  select?: string;
  equation?: string;
  /** Seconds the step holds once landed before a playing guide moves on. */
  dwell?: number;
};

/** A step's hold when it sets none: time to read a caption and look. */
export const GUIDE_DWELL = 14;

export const TOUR: readonly TourStep[] = [
  {
    id: "continuum",
    view: "kirchhoff",
    bench: { lamp: 5800, gas: 2000, column: 12, elements: [] },
    equation: "wien-displacement",
  },
  {
    id: "absorption",
    view: "kirchhoff",
    bench: { ...BENCH_DEFAULT, lamp: 5800 },
    range: [583, 596],
    select: "na1-588.995",
    equation: "photon-energy",
  },
  {
    id: "emission",
    view: "kirchhoff",
    bench: { ...BENCH_DEFAULT, lamp: 0 },
    range: [583, 596],
    select: "na1-588.995",
    equation: "slab-transfer",
  },
  {
    id: "hydrogen",
    view: "kirchhoff",
    bench: { lamp: 20_000, gas: 10_000, column: 24.5, elements: ["H"] },
    select: "h1-656.279",
    equation: "rydberg-formula",
  },
  { id: "fraunhofer", view: "sun", letters: true, air: true, velocity: 0 },
  {
    id: "fingerprint",
    view: "sun",
    letters: true,
    air: true,
    velocity: 0,
    compare: ["Na", "Mg", "Fe"],
    range: [512, 596],
  },
  {
    id: "air",
    view: "sun",
    letters: true,
    air: true,
    velocity: 300,
    compare: ["H"],
    range: [645, 770],
    equation: "doppler-shift",
  },
  {
    id: "sequence",
    view: "stars",
    star: "vega",
    compare: ["H"],
    select: "h1-486.135",
    equation: "saha-equation",
  },
  {
    id: "cool",
    view: "stars",
    star: "arcturus",
    compare: ["Ca", "Fe"],
    select: "ca1-422.673",
    equation: "boltzmann-law",
  },
  {
    id: "mystery",
    view: "mystery",
    mystery: { kind: "dwarf", teff: 6750, velocity: 42 },
    compare: [],
  },
];
