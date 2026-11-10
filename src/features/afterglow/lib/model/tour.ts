/**
 * The guided journey: the Sun's life in ten steps, each at an age, from a world, with one
 * formula where one applies and a way across to the lab that shows more, framed on what it is
 * about. Copy lives in `tour.steps.<id>`; the caption holds while it is read, then the journey
 * moves on: left to play, it plays the life on to the next step and lands it on a beat of its
 * track.
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
  /** The beat of the journey's track the step lands on (`JOURNEY_MUSIC`). */
  beat: number;
  /**
   * Seconds the journey takes to play the life on to this step when it moves on by itself, its
   * caption already up; a hand's step is there at once.
   */
  ride: number;
  /** Seconds the caption holds once the step has landed, before the journey moves on. */
  dwell?: number;
  shot: Shot;
};

/** Seconds a landed step holds where the journey names none (its last). */
export const TOUR_DWELL = 12;

/**
 * The journey is timed to "The Last Breath", which keeps one tempo: its beats fall `beatS`
 * apart from the first at `firstBeatS`, measured on the published file (the autocorrelation of
 * its onsets; a re-cut track is measured again). Each step lands on a beat where the music
 * enters again after a breath or a phrase begins, so the life plays on between the steps and
 * arrives with the music.
 */
export const JOURNEY_MUSIC = { track: "The Last Breath", beatS: 0.5397, firstBeatS: 0.29 } as const;

/** The second of the journey's track a beat falls on. */
export const beatAt = (beat: number) => JOURNEY_MUSIC.firstBeatS + beat * JOURNEY_MUSIC.beatS;

const GYR = 1e9;
const MYR = 1e6;

/** The moments three steps stand at, which their copy's figures are quoted for (`catalogue.ts`). */
export const FLASH_STEP_AGE = HELIUM_START + 30 * MYR;
export const PULSES_STEP_AGE = AGB_END - 0.2 * MYR;
export const DWARF_STEP_AGE = NEBULA_END + 2 * GYR;

const STEPS: readonly Omit<TourStep, "dwell">[] = [
  {
    id: "young",
    /* The track's first bars. */
    beat: 0,
    ride: 0,
    age: 0,
    world: "earth",
    equation: "young-sun-luminosity",
    crossing: "orrery",
    shot: ON_DISC,
  },
  {
    id: "today",
    /* The music enters again after its first breath. */
    beat: 39,
    ride: 6,
    age: TODAY,
    world: "earth",
    equation: "stefan-boltzmann",
    crossing: "sun",
    shot: ON_DISC,
  },
  {
    id: "oceans",
    /* Its second entry. */
    beat: 73,
    ride: 6,
    /* The zone's inner edge on Earth's orbit: the moment the caption's first figure names. */
    age: OCEANS_GOING,
    world: "earth",
    equation: "habitable-zone-edge",
    shot: ON_WORLD,
  },
  {
    id: "swell",
    /* A phrase begins, well into the body: the long drying and swelling play under it. */
    beat: 154,
    ride: 22,
    age: MS_END + 2 * GYR,
    world: "earth",
    equation: "stellar-radius",
    shot: ON_SKY,
  },
  {
    id: "warm",
    /* The entry after the break. */
    beat: 202,
    ride: 8,
    age: WARM_SPELL,
    world: "enceladus",
    equation: "sunlight-share",
    shot: ON_WORLD,
  },
  {
    id: "swallow",
    /* The loudest stretch begins as the giant has grown: the climb plays through the build. */
    beat: 256,
    ride: 17,
    age: RGB_TIP - 1 * MYR,
    world: "mars",
    equation: "orbit-widening",
    crossing: "spectroscopy",
    shot: ON_SKY,
  },
  {
    id: "flash",
    age: FLASH_STEP_AGE,
    world: "europa",
    /* The entry after the second break: the collapse plays through the break. */
    beat: 330,
    ride: 12,
    shot: ON_DISC,
  },
  {
    id: "pulses",
    /* A quieter passage. */
    beat: 368,
    ride: 10,
    age: PULSES_STEP_AGE,
    world: "enceladus",
    equation: "orbital-period",
    shot: ON_DISC,
  },
  {
    id: "nebula",
    /* The bright peak begins. */
    beat: 392,
    ride: 7,
    age: AGB_END + 5_000,
    world: "pluto",
    equation: "angular-size",
    shot: ON_SKY,
  },
  {
    id: "dwarf",
    /* The last entry, into the long wind-down. */
    beat: 460,
    ride: 16,
    age: DWARF_STEP_AGE,
    world: "pluto",
    equation: "wien-displacement",
    crossing: "giants",
    shot: ON_DISC,
  },
];

/**
 * The journey: each step holds from its beat until the journey must leave to land the next on
 * its own, so its holds and rides add up to the music's beats. The last holds for nothing.
 */
export const TOUR: readonly TourStep[] = STEPS.map((step, index) => {
  const next = STEPS[index + 1];
  return next ? { ...step, dwell: beatAt(next.beat) - beatAt(step.beat) - next.ride } : step;
});
