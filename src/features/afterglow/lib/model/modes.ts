/**
 * The three ways Afterglow plays, each with its own camera, read in one place by the scene.
 *
 * - `timeline`, the visitor's own: the view is theirs to turn, the camera sways a
 *   little while the clock runs, and a change of world is a ship's flight (`flight.ts`).
 * - `guide`, a lesson: each step frames what its caption is about (`TourStep.shot`): the
 *   disc close for the Sun's own figures, the globe for a world's, the sky for the nebula;
 *   the camera glides there, holds still while it is read, and a change of world is a cut,
 *   the old view dissolving into the next, so the lesson moves on at once.
 * - `drift`, lean back: the camera never holds still, wandering slowly across the Sun and the
 *   limb on long incommensurate periods, and a change of world is a long, slow voyage.
 */
import type { DriftState } from "@/lib/drift";

import { DRIFT_FLIGHT_S, FLIGHT_S } from "./parameters";

export type ModeId = "timeline" | "guide" | "drift";

/**
 * The camera's sway while the clock runs: the Sun's swing across the view as a share of how far
 * a turn may take it (so every aspect sways alike), the limb's rise and fall as a share of the
 * view's height, and their periods, seconds.
 */
export type Sway = { across: number; horizon: number; acrossPeriod: number; horizonPeriod: number };

export type ModeStyle = {
  /** A change of world: flown (`flight.ts`), or dissolved in place. */
  change: "flight" | "dissolve";
  /** Seconds a flight takes. */
  flightS: number;
  sway: Sway;
};

/** Seconds a framing a mode sets (a guide step's shot, the drift's opening view) takes to glide into place. */
export const GLIDE_S = 2.4;

export const MODES: Readonly<Record<ModeId, ModeStyle>> = {
  timeline: {
    change: "flight",
    flightS: FLIGHT_S,
    sway: { across: 0.065, horizon: 0.012, acrossPeriod: 47, horizonPeriod: 31 },
  },
  guide: {
    change: "dissolve",
    flightS: FLIGHT_S,
    sway: { across: 0, horizon: 0, acrossPeriod: 47, horizonPeriod: 31 },
  },
  drift: {
    change: "flight",
    flightS: DRIFT_FLIGHT_S,
    sway: { across: 0.35, horizon: 0.07, acrossPeriod: 89, horizonPeriod: 61 },
  },
};

/** The mode the store is in: the drift over the guide over the visitor's own timeline. */
export const modeOf = (s: { drift: DriftState; guideOpen: boolean }): ModeId => {
  if (s.drift !== "off") {
    return "drift";
  }
  return s.guideOpen ? "guide" : "timeline";
};

type Clock = { playing: boolean; drift: DriftState };

/** Whether the clock is paused: by the visitor's own control, or by the autoplay's. */
export const clockPaused = (s: Clock) => !s.playing || s.drift === "paused";

/**
 * Whether the clock runs, and with it all it moves (the sway, the world's turn): not while
 * paused, and not behind the autoplay's loader, so the life starts when the autoplay does.
 */
export const clockRuns = (s: Clock) => !clockPaused(s) && s.drift !== "loading";

/**
 * Whether the world turns under the camera: as the clock runs, and through a journey left to
 * play, whose own clock stands still between its rides, so a held step is never a still.
 */
export const worldTurns = (s: Clock & { guideOpen: boolean; guidePlaying: boolean }) =>
  clockRuns(s) || (s.guideOpen && s.guidePlaying);
