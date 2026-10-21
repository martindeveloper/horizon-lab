import type { CuedShot, DriftProgramme } from "@/lib/drift";
/**
 * The Orrery's drift: the lean-back tour of the solar system, wide across the orbits one moment
 * and down at a world's surface the next, timed to "Interstellar Drift" (259 s, looping every
 * 251 s after the player's 8 s crossfade). The track is a slow swell: a dip at 19 s, a crest
 * at 132–170 s, a settle near 200 s and a bright shimmer at 215 s. One tour spans two plays of
 * it: Jupiter's dive begins on the first crest, and the Oort cloud lands on the second, the
 * widest view at the music's height before the long fall home. A shot is a view's framing,
 * nudged in distance and tilt, or a close-up: the drift selects the body, flies in on the
 * close-up's own flight, slowed to a lean-back pace and settling onto the body, circles it
 * while it drifts nearer, then pulls out once to frame it with its largest moon and flies on
 * from there, so a body is dived to and pulled away from once each: before a framed shot the
 * pull away is that shot's own flight (`withVisitFlights` gives it the flight out's seconds), before
 * another visit the close-up's own flight out. The holds
 * written here are the timing without a map and add up to the two plays; `timeShots` sets them
 * so the cued shots meet their cues, a hold at a body lingering as needed. The camera
 * (`createDriftCamera`) spreads angles and distance a little each pass; lengths never vary.
 * While the drift is on, the Motion speed-up (the Orrery's own, unrelated "drift" switch) is
 * held to `clock` model years per real second, so the inner planets and the belt glide rather
 * than whirl when seen from the giants.
 */
import type { SolarSelection } from "@/space/solar-system/model/selection";
import type { SolarViewId } from "@/space/solar-system/model/views";
import type { DriftPoseShot, OrbitPose } from "@horizon/toolkit/camera";

import { CLOSE_UP_IN_S, CLOSE_UP_OUT_S, type MoonSwing } from "./scene/close-up-flight";

/** A body the close-up can frame: the Sun, a planet or a named body. */
export type CloseUpBody = Extract<SolarSelection, { kind: "sun" | "planet" | "named" }>;

export type OrreryDriftShot = CuedShot &
  (
    | (Omit<DriftPoseShot, keyof OrbitPose> & {
        /** The view whose framing the shot starts from. */
        view: SolarViewId;
        /** Nudges to that framing. */
        pose?: Partial<OrbitPose>;
      })
    | {
        /** The body to visit at true size, on the close-up's own flights. */
        closeUp: CloseUpBody;
        /** Seconds at the body; the programme's default otherwise. */
        hold?: number;
        /** Seconds the close-up's own flights take, for timing (`withVisitFlights` sets it). */
        flight?: { duration: number };
      }
  );

export type OrreryDrift = DriftProgramme<OrreryDriftShot> & {
  /** The most model years one real second covers while the drift is on; Motion's own rate below it. */
  clock: number;
  /**
   * At a body: seconds held, the slow orbit's rate (rad/s), how near the camera drifts (a
   * fraction of the arrival distance), how many times slower than a tap's the flights in
   * and out are, the zoom's lead on them (`sampleCloseUp`: most of the flight spent where the
   * body is large), and when in the hold (fractions) the camera swings out to frame the body
   * with its largest moon, arrives, leaves and is back (`moonSwing`: left at the moon when the
   * last two marks leave no time, so the flight out goes from there).
   */
  closeUp: {
    hold: number;
    orbit: number;
    dive: number;
    pace: number;
    lead: number;
    moon: MoonSwing;
  };
};

/** How many times slower than a tap's the drift's close-up flights are, and seconds held at a body. */
const CLOSE_UP_PACE = 4;
const CLOSE_UP_HOLD = 16;

/** A visit to a body, its hold written out. */
function closeUpShot(
  closeUp: CloseUpBody,
  hold = CLOSE_UP_HOLD,
  cue?: Pick<CuedShot, "at">,
): OrreryDriftShot {
  return { ...cue, closeUp, hold };
}

/** Seconds of a framed shot's flight when its shot names none. */
const FLIGHT = 22;

/**
 * Whether the visit at `index` pulls away on the next shot's own flight, a framed shot
 * following it in the sequence, rather than on the close-up's flight out before another visit.
 */
export function pullsAwayOnward(shots: readonly OrreryDriftShot[], index: number) {
  const next = shots[(index + 1) % shots.length];
  return next !== undefined && !("closeUp" in next);
}

/**
 * The shots with each visit's flights counted, so the timing can place the shots after it: a
 * visit flies in on its own and out on its own only before another visit; pulling away onward
 * (`pullsAwayOnward`), the next shot's flight takes the flight out's seconds on top of its own.
 * The loop's length stays as written.
 */
function withVisitFlights(shots: readonly OrreryDriftShot[]): OrreryDriftShot[] {
  const out = CLOSE_UP_OUT_S * CLOSE_UP_PACE;
  return shots.map((shot, i) => {
    if ("closeUp" in shot) {
      const own = CLOSE_UP_IN_S * CLOSE_UP_PACE + (pullsAwayOnward(shots, i) ? 0 : out);
      return { ...shot, flight: { duration: own } };
    }
    /* A framed shot after a visit is the one that visit pulls away on. */
    const before = shots[(i + shots.length - 1) % shots.length]!;
    if (!("closeUp" in before)) return shot;
    return {
      ...shot,
      flight: { ...shot.flight, duration: (shot.flight?.duration ?? FLIGHT) + out },
    };
  });
}

export const DRIFT: OrreryDrift = {
  music: { track: "Interstellar Drift", period: 251, loops: 2 },
  camera: {
    flight: FLIGHT,
    hold: 12,
    variance: 0.3,
    timeVariance: 0,
    drift: 0.01,
    creep: 0.05,
    order: "sequence",
  },
  clock: 0.04,
  closeUp: {
    hold: CLOSE_UP_HOLD,
    orbit: 0.045,
    dive: 0.55,
    pace: CLOSE_UP_PACE,
    lead: 1,
    /* Out to the moon over the hold's last part, and left there: the flight out goes from it. */
    moon: [0.55, 0.85, 1, 1],
  },
  shots: withVisitFlights([
    /* Low among the inner planets as the track opens, then down to Earth. */
    {
      at: "start",
      view: "inner",
      pose: { distance: 4.5, inclination: 0.35 },
      flight: { duration: 20, lift: 0.15, lead: 0.3 },
      hold: 4,
    },
    closeUpShot({ kind: "planet", id: "earth" }, 18),
    {
      view: "inner",
      pose: { distance: 9, inclination: 1.2 },
      flight: { duration: 16, lead: -0.2 },
      hold: 6,
    },
    closeUpShot({ kind: "planet", id: "mars" }, 14),
    /* The giants framed and held across the music's first crest, then the dive to Jupiter on it. */
    { view: "giants", pose: { inclination: 0.5 }, flight: { duration: 22, lift: 0.1 }, hold: 16 },
    closeUpShot({ kind: "planet", id: "jupiter" }, 18, { at: "peak" }),
    /* Edge-on across the giants' orbits, then Saturn's rings, over the loop's seam. */
    {
      view: "giants",
      pose: { distance: 40, inclination: 0.15 },
      flight: { duration: 18, swing: 0.1 },
      hold: 4,
    },
    closeUpShot({ kind: "planet", id: "saturn" }, 18),
    /* Out through the belt to Neptune and Pluto. */
    { view: "kuiper", pose: { inclination: 0.9 }, flight: { duration: 20 }, hold: 6 },
    closeUpShot({ kind: "planet", id: "neptune" }, 12),
    closeUpShot({ kind: "named", id: "pluto" }, 10),
    /* On to the Oort cloud, landing on the second crest, held at the music's height. */
    { view: "scattered", flight: { duration: 20, lead: 0.3 }, hold: 2 },
    { land: "peak@2", view: "oort", flight: { duration: 28 }, hold: 36, creep: -0.04 },
    /* And one long fall back to the giants, from above, as the track settles. */
    { view: "giants", pose: { inclination: 1.3 }, flight: { duration: 40, lift: -0.1 }, hold: 14 },
  ]),
};
