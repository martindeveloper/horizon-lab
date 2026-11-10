/**
 * The guided journey: the Sun's life in ten steps, each at an age, from a world, with one
 * formula where one applies and a way across to the lab that shows more, framed on what it is
 * about. Copy lives in `tour.steps.<id>`; the caption holds while it is read, then the journey
 * moves on.
 */
import { OCEANS_GOING } from "./oceans";
import { AGB_END, HELIUM_START, MS_END, NEBULA_END, RGB_TIP, TODAY } from "./track";
import { WARM_SPELL, type WorldId } from "./worlds";

/** Where a step crosses to: another simulation that shows what the step names. */
export type Crossing = "orrery" | "sun" | "spectroscopy" | "giants";

/**
 * What a step frames, so the view shows what its caption is about: where the Sun stands across
 * the view (a share of its width from the left), where the limb sits (a share of its height
 * from the top: high to show the globe, low to give the sky). The disc keeps the framing's size:
 * only the Sun's radius changes it. Unset parts are the resting view's.
 */
export type Shot = { across?: number; horizon?: number };

/**
 * The caption stands over the middle and lower part of the view, so a shot keeps the Sun above
 * this share of the view's height from the top. The Sun stands
 * `SUN_LIFT` over the limb, so the limb's place sets the Sun's.
 */
export const CAPTION_TOP = 0.45;

/** The disc, for a step about the Sun's own figures: centred, high over the limb. */
const ON_DISC: Shot = { across: 0.5, horizon: 0.5 };
/** The globe, for a step about the world: the limb high, filling the view, the Sun off to the side. */
const ON_WORLD: Shot = { across: 0.78, horizon: 0.5 };
/** The open sky, for a step about what fills it: the Sun centred and high, so a giant or the nebula fills the view. */
const ON_SKY: Shot = { across: 0.5, horizon: 0.52 };

export type TourStep = {
  id: string;
  /** Years since the first solids. */
  age: number;
  world: WorldId;
  /** A formula the caption prints (`AFTERGLOW_EQUATIONS`). */
  equation?: string;
  crossing?: Crossing;
  /** Seconds the caption holds once the step has landed, before the journey moves on. */
  dwell?: number;
  shot: Shot;
};

/** Seconds a landed step holds by default. */
export const TOUR_DWELL = 12;

const GYR = 1e9;
const MYR = 1e6;

/** The moments three steps stand at, which their copy's figures are quoted for (`catalogue.ts`). */
export const FLASH_STEP_AGE = HELIUM_START + 30 * MYR;
export const PULSES_STEP_AGE = AGB_END - 0.2 * MYR;
export const DWARF_STEP_AGE = NEBULA_END + 2 * GYR;

export const TOUR: readonly TourStep[] = [
  {
    id: "young",
    age: 0,
    world: "earth",
    equation: "young-sun-luminosity",
    crossing: "orrery",
    shot: ON_DISC,
  },
  {
    id: "today",
    age: TODAY,
    world: "earth",
    equation: "stefan-boltzmann",
    crossing: "sun",
    shot: ON_DISC,
  },
  {
    id: "oceans",
    /* The zone's inner edge on Earth's orbit: the moment the caption's first figure names. */
    age: OCEANS_GOING,
    world: "earth",
    equation: "habitable-zone-edge",
    shot: ON_WORLD,
  },
  {
    id: "swell",
    age: MS_END + 2 * GYR,
    world: "earth",
    equation: "stellar-radius",
    shot: ON_SKY,
  },
  {
    id: "warm",
    age: WARM_SPELL,
    world: "enceladus",
    equation: "sunlight-share",
    shot: ON_WORLD,
  },
  {
    id: "swallow",
    age: RGB_TIP - 1 * MYR,
    world: "mars",
    equation: "orbit-widening",
    crossing: "spectroscopy",
    dwell: 16,
    shot: ON_SKY,
  },
  { id: "flash", age: FLASH_STEP_AGE, world: "europa", shot: ON_DISC },
  {
    id: "pulses",
    age: PULSES_STEP_AGE,
    world: "enceladus",
    equation: "orbital-period",
    shot: ON_DISC,
  },
  {
    id: "nebula",
    age: AGB_END + 5_000,
    world: "pluto",
    equation: "angular-size",
    shot: ON_SKY,
  },
  {
    id: "dwarf",
    age: DWARF_STEP_AGE,
    world: "pluto",
    equation: "wien-displacement",
    crossing: "giants",
    dwell: 16,
    shot: ON_DISC,
  },
];
