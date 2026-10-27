import { audioMapNow } from "@/lib/audio-maps";
import {
  driftRunState,
  openingFor,
  timedDrift,
  type CuedShot,
  type DriftProgramme,
  type DriftSlice,
  type DriftState,
} from "@/lib/drift";
import type { AudioMap } from "@horizon/toolkit/audio";
import type { DriftPoseShot, DriftShot, OrbitPose } from "@horizon/toolkit/camera";
import { clamp, smootherstep } from "@horizon/toolkit/math";
import { createRigDrift, type OrbitRig, type RigDrift } from "@horizon/toolkit/scene";

/**
 * A drift's visits: shots the host flies as close-ups (`VisitShot`), one dive to a body and one
 * pull away. The visit opens the close-up the shot names, whose own flight takes the camera in,
 * slowed to a lean-back pace and settling onto the body; circles the body slowly through the
 * hold, the way the drift was turning, while it drifts nearer; may fly on deeper to a body of
 * the same system (`onward`, the dive's second stage) and circle that; then lets go. A visit before a framed shot pulls away on that
 * shot's own flight (the close-up released to it, keeping the body in view until the flight
 * hands the aim home), so the release flows on without a stop; before another visit the
 * close-up flies out itself. Flying on after a pause leaves any close-up first. Shared by the
 * Orrery and Deep Field; each host owns its close-up, its store and its programme.
 */
import { CLOSE_UP_IN_S, CLOSE_UP_OUT_S, type CloseUpStyle } from "./close-up-flight";

export type VisitShot<Body> = CuedShot & {
  /** The body to visit at true size, on the close-up's own flights. */
  closeUp: Body;
  /** Seconds at the body; the programme's default otherwise. */
  hold?: number;
  /**
   * A body of the same system the visit flies on to after its hold, deeper in, and holds at
   * before it lets go: one push-in in two stages (Earth, then Hubble above it), never out and
   * back in.
   */
  onward?: { closeUp: Body; hold: number };
  /**
   * Seconds the visit spends besides its first hold, for timing: its close-up's own flights and,
   * flying onward, the hold there (`withVisitFlights` sets it).
   */
  flight?: { duration: number };
};

/**
 * How a drift lingers at a body: seconds held, the slow orbit's rate (rad/s, turning the way
 * the drift was), how near the camera drifts (a fraction of the arrival distance), how many
 * times slower than a tap's the flights in and out are, and the zoom's lead on them
 * (`sampleCloseUp`: most of the flight spent where the body is large).
 */
export type VisitSettings = {
  hold: number;
  orbit: number;
  dive: number;
  pace: number;
  lead: number;
};

/** Every drift's visits but for how long they hold. */
export const DRIFT_VISIT: Omit<VisitSettings, "hold"> = {
  orbit: 0.045,
  dive: 0.55,
  pace: 4,
  lead: 1,
};

const isVisit = <Body>(shot: object | VisitShot<Body>): shot is VisitShot<Body> =>
  "closeUp" in shot;

/**
 * Whether the visit at `index` pulls away on the next shot's own flight, a framed shot
 * following it in the sequence, rather than on the close-up's flight out before another visit.
 */
export function pullsAwayOnward(shots: readonly object[], index: number) {
  const next = shots[(index + 1) % shots.length];
  return next !== undefined && !isVisit(next);
}

/**
 * The shots with each visit's flights counted at the visits' `pace`, so the timing can place the
 * shots after it: a visit flies in on its own (twice, and holds again, when it flies onward) and
 * out on its own only before another visit; pulling away onward (`pullsAwayOnward`), the next
 * shot's flight (`flight` seconds when it names none) takes the flight out's seconds on top of
 * its own. The loop's length stays as written.
 */
export function withVisitFlights<Shot extends { flight?: { duration?: number } }>(
  shots: readonly Shot[],
  pace: number,
  flight: number,
): Shot[] {
  const out = CLOSE_UP_OUT_S * pace;
  return shots.map((shot, i) => {
    if (isVisit(shot)) {
      const dive = CLOSE_UP_IN_S * pace;
      const onward = shot.onward ? dive + shot.onward.hold : 0;
      const own = dive + onward + (pullsAwayOnward(shots, i) ? 0 : out);
      return { ...shot, flight: { duration: own } };
    }
    /* A framed shot after a visit is the one that visit pulls away on. */
    const before = shots[(i + shots.length - 1) % shots.length]!;
    if (!isVisit(before)) return shot;
    return {
      ...shot,
      flight: { ...shot.flight, duration: (shot.flight?.duration ?? flight) + out },
    };
  });
}

/** What a visit needs to know about the close-up in progress. */
export type VisitFrame = { phase: "in" | "on" | "out"; released: OrbitPose | null };

/** Radians the camera sways above and below its arrival tilt at a body. */
const SWAY = 0.12;

/**
 * A visit to a body: waiting for a flight in, circling, or waiting for the flight out; `onward`
 * once it has flown on to its second body.
 */
type Visit =
  | { phase: "in"; onward: boolean }
  | {
      phase: "on";
      onward: boolean;
      held: number;
      hold: number;
      distance: number;
      inclination: number;
      azimuth: number;
      /** The orbit's direction, ±1: the drift's turn carried on, never reversed. */
      spin: number;
    }
  | { phase: "out" };

/** What a simulation tells the visits: how its close-up opens, lets go and flies out. */
export type VisitHooks<Body> = {
  /** Selects the body and opens its close-up; false when it cannot be had, skipping the visit. */
  open: (body: Body) => boolean;
  /** Lets the body's selection go, and the close-up with it unless it was released. */
  letGo: () => void;
  /** Leaves a close-up the drift is not visiting (one left from a pause). */
  leave: () => void;
  /** The close-up in progress, or null. */
  closeUp: () => VisitFrame | null;
  /** Hands the close-up's flight out to the drift's flight landing on `landing`. */
  release: (landing: OrbitPose) => void;
  /** The close-up flies a released flight on to its landing itself. */
  reclaim: () => void;
  /** The released flight has landed: the close-up ends where the drift left the camera. */
  finish: () => void;
  /**
   * The pose a visit's last hold `t` (0..1) of the way through frames from its circling `base`
   * (the Orrery's moon); a hold the visit flies on from only circles.
   */
  frame?: (base: OrbitPose, t: number) => OrbitPose;
};

export function createDriftVisits<Body>(
  rig: Pick<OrbitRig, "pose" | "settle" | "limits">,
  options: VisitHooks<Body> & {
    settings: VisitSettings;
    reduceMotion: { matches: boolean };
    /** The programme's shots as timed now: a hold at a body may linger to meet a cue. */
    shots: () => readonly (object | VisitShot<Body>)[];
    /** The drift run on the rig. */
    drift: () => RigDrift;
  },
) {
  const { settings, reduceMotion, closeUp } = options;
  let visit: Visit | null = null;

  /** Begins the close-up the handoff names, or skips it when it cannot be had. */
  function enter(index: number, resume: () => void) {
    const shot = options.shots()[index];
    if (!shot || !isVisit(shot) || !options.open(shot.closeUp)) return resume();
    visit = { phase: "in", onward: false };
  }

  /**
   * Lets the body go at the end of its hold: on the drift's next flight when a framed shot
   * follows (the drift flies on at once), else on the close-up's own flight out.
   */
  function letGo(index: number, resume: () => void) {
    if (pullsAwayOnward(options.shots(), index)) {
      resume();
      const landing = options.drift().landing;
      if (landing) options.release(landing);
      visit = null;
    } else visit = { phase: "out" };
    options.letGo();
  }

  /** Circles the body and drifts nearer through the hold; the last hold also frames (`frame`). */
  function circle(at: Extract<Visit, { phase: "on" }>, dt: number, last: boolean) {
    at.held += dt;
    if (reduceMotion.matches) return;
    const t = Math.min(1, at.held / at.hold);
    const ramp = 1 - Math.exp(-at.held / 3);
    at.azimuth += settings.orbit * at.spin * ramp * dt;
    const { min, max } = rig.limits();
    const base = {
      azimuth: at.azimuth,
      inclination: at.inclination + SWAY * Math.sin(t * Math.PI),
      distance: clamp(at.distance * settings.dive ** smootherstep(t), min, max),
    };
    Object.assign(rig.pose, (last && options.frame?.(base, t)) || base);
    rig.settle();
  }

  return {
    /** The drift's handoff: the visit at `index`, frame by frame, until its close-up has closed again. */
    handoff: (index: number, dt: number, resume: () => void) => {
      const close = closeUp();
      if (!visit) return enter(index, resume);
      const shot = options.shots()[index];
      const onward = shot && isVisit(shot) ? shot.onward : undefined;
      if (visit.phase === "in") {
        if (!close) return resume();
        if (close.phase === "on") {
          visit = {
            phase: "on",
            onward: visit.onward,
            held: 0,
            hold: visit.onward
              ? onward!.hold
              : ((shot && isVisit(shot) ? shot.hold : undefined) ?? settings.hold),
            distance: rig.pose.distance,
            inclination: rig.pose.inclination,
            azimuth: rig.pose.azimuth,
            spin: Math.sign(options.drift().motion.azimuth) || 1,
          };
        }
        return;
      }
      if (visit.phase === "on") {
        if (!close) visit = { phase: "out" };
        else {
          const last = visit.onward || !onward;
          circle(visit, dt, last);
          if (visit.held < visit.hold) return;
          /* On deeper into the same system: one flight in, the close-up's own. */
          if (!last && options.open(onward.closeUp)) {
            visit = { phase: "in", onward: true };
            return;
          }
          return letGo(index, resume);
        }
      }
      if (visit.phase === "out" && !close) {
        visit = null;
        resume();
      }
    },
    /**
     * How the visits fly: at a lean-back pace, settling slowly onto the body, and scripted, so
     * the flight in carries on the drift's turn.
     */
    style: (): CloseUpStyle => ({
      pace: settings.pace,
      lead: settings.lead,
      scripted: { motion: { ...options.drift().motion } },
    }),
    /**
     * Call before the drift steps, with the drift's state: ends or reclaims a released pull
     * away, leaves a close-up the drift is about to fly on from, and forgets a visit the drift
     * no longer plays. Returns whether the drift should hold while that close-up flies out.
     */
    step(state: DriftState) {
      const drift = options.drift();
      /* A released pull away ends as the drift's flight lands; one the drift no longer flies
         (it was paused, then resumed afresh, or stopped) the close-up flies on itself. A pause
         holds it where it is. */
      if (closeUp()?.released) {
        if (state === "playing" && drift.flying) {
          if (!drift.landing) options.finish();
        } else if (state !== "paused") options.reclaim();
      }
      /* A close-up left from a pause (or the visitor's own) flies out before the drift goes on. */
      const leaving = state === "playing" && !drift.flying && closeUp() !== null;
      if (leaving) options.leave();
      if (state !== "playing") visit = null;
      return leaving;
    },
  };
}

/** A shot that frames a view as the rig frames it, nudged by `pose`, with a pose shot's other fields. */
export type FramedShot<View> = CuedShot &
  Omit<DriftPoseShot, keyof OrbitPose> & {
    view: View;
    pose?: Partial<OrbitPose>;
  };

const isFramed = <View, Body>(shot: FramedShot<View> | VisitShot<Body>): shot is FramedShot<View> =>
  "view" in shot;

/**
 * A drift on a rig whose shots frame views and visit bodies, the same in every space scene: the
 * programme timed to its track's map once that has loaded (a map that arrives since retimes it,
 * unless it is flying: that run keeps its timing), its framed shots posed by the rig and its
 * visits handed off to the shared visits, opened on the shot whose cue the music is nearest.
 * `busy` while the store says the drift plays; `takeOver` when the viewer moves the camera.
 * `step` each frame, before the rig steps; a scene with more to do each shot (the Orrery's
 * clock) reads the run and the shots as timed.
 */
export function createVisitingDrift<View, Body>(
  rig: Pick<OrbitRig, "pose" | "cancel" | "settle" | "limits"> & {
    framing: (view: View) => OrbitPose;
  },
  programme: DriftProgramme<FramedShot<View> | VisitShot<Body>> & { closeUp: VisitSettings },
  options: {
    reduceMotion: { matches: boolean };
    store: { getState: () => Pick<DriftSlice, "drift" | "pauseDrift"> };
    /** Where the music stands, seconds into its track (null while it is off), for the opening shot. */
    musicPosition: () => number | null;
    visits: VisitHooks<Body>;
  },
) {
  const { reduceMotion, store, musicPosition } = options;
  /** The programme timed to its track's map: a hold at a body may linger to meet a cue. */
  let timed = timedDrift(programme, null);
  let timedWith: AudioMap | null = null;
  let drift: RigDrift;
  const visits = createDriftVisits<Body>(rig, {
    ...options.visits,
    settings: programme.closeUp,
    reduceMotion,
    shots: () => timed.shots,
    drift: () => drift,
  });
  /** A shot as the rig flies it: a visit is handed off; a framed view is posed by the rig. */
  const posed = (shot: FramedShot<View> | VisitShot<Body>): DriftShot => {
    if (!isFramed(shot)) return { handoff: true };
    const { view, pose, ...rest } = shot;
    return { ...rig.framing(view), ...pose, ...rest };
  };
  /** The drift timed by `map`: a run on the rig. */
  function build(map: AudioMap | null) {
    timed = timedDrift(programme, map);
    timedWith = map;
    drift = createRigDrift(
      rig,
      timed.shots.map(posed),
      {
        ...programme.camera,
        /* The drift's curtain covers a fresh start: the camera cuts to the opening shot. */
        cut: true,
        reduceMotion,
        opening: () => openingFor(timed, musicPosition()),
      },
      { handoff: visits.handoff },
    );
  }
  build(audioMapNow(programme.music?.track));
  return {
    /** How the drift's visits fly. */
    visitStyle: visits.style,
    /** Frames are needed while the drift plays. */
    get busy() {
      return store.getState().drift === "playing";
    },
    /** The viewer moved the camera: the drift waits for them. */
    takeOver() {
      store.getState().pauseDrift();
    },
    /** The run under way. */
    get run() {
      return drift;
    },
    /** The programme's shots as timed now, in the programme's order. */
    get shots(): readonly (FramedShot<View> | VisitShot<Body>)[] {
      return timed.shots;
    },
    /** Steps the visits, then the run; the drift's state as it was read. */
    step(dt: number): DriftState {
      const state = store.getState().drift;
      const leaving = visits.step(state);
      const map = audioMapNow(programme.music?.track);
      if (map !== timedWith && !drift.flying) build(map);
      drift.step(driftRunState(state), dt, leaving);
      return state;
    },
  };
}
