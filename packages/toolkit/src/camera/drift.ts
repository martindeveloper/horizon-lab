/**
 * Drift: a camera that flies itself, for as long as it is left alone. It takes a list of shots
 * and goes from one to the next: a long flight (`sampleOrbitFlight`, log-linear in distance, so
 * a zoom across scales keeps an even pace), then a hold with a slow orbit and a gentle push,
 * then the next shot. Under it all the camera keeps turning and its tilt slowly breathes, so
 * it never stands dead still between a landing and the next flight. Variance jitters each
 * shot's angles, distance and timing, so no two passes look alike. Pure: no rig, no renderer; a host assigns the pose to its own camera. A
 * shot the host flies itself (a close-up on its own rig) is a handoff: the camera waits there
 * until the host says `resume`. A host with a curtain may `cut`: a fresh start then begins
 * landed on its opening shot, already in its hold, instead of flying there from wherever the
 * visitor left the camera.
 */
import { clamp, lerp, smootherstep, wrapSigned } from "../math";
import { sampleOrbitFlight, type OrbitFlight, type OrbitPose } from "./flight";
import type { AimedPose, FreeLook } from "./free-pose";

/**
 * The drawn pose: an orbit pose with its tilt, where it looks (`freeFromOrbit` makes it a free
 * pose) and how far it rides with the scene's own flow.
 */
export type DriftPose = OrbitPose & { roll: number; look: FreeLook; ride: number };

/** A shot the host flies itself: the camera leaves the pose alone until `resume`. */
export type DriftHandoff = { handoff: true };

/** Where a drift goes, and how it gets there and waits. */
export type DriftShot = DriftHandoff | DriftPoseShot;

export type DriftPoseShot = OrbitPose & {
  /** Dutch tilt at the shot, radians; 0 by default. */
  roll?: number;
  /** Where the camera looks off its aim at the shot (see `FreeLook`); at the aim by default. */
  look?: FreeLook;
  /**
   * 0–1: how far the camera moves with the scene's own flow at the shot (the host decides what
   * flows, e.g. orbiting gas); 0, hovering, by default.
   */
  ride?: number;
  /** Flight shaping (see `sampleOrbitFlight`) and its length in seconds. */
  flight?: Pick<OrbitFlight, "lift" | "swing" | "lead"> & { duration?: number };
  /** Seconds the shot holds once landed, before the next flight. */
  hold?: number;
  /** Orbit rate while held, rad/s, eased in and out; by default the settings' rate. */
  drift?: number;
  /** Fraction of the distance pushed in (+) or out (−) over the hold. */
  creep?: number;
  /**
   * A reveal for the opening, played only when a start cuts to this shot (behind a curtain):
   * the camera begins looking off at `look`, rests there `rest` seconds, then turns onto the
   * shot's own look over `turn` seconds of the hold. Flown to in a loop, the shot never plays it.
   */
  unveil?: { look: FreeLook; rest: number; turn: number };
};

export type DriftSettings = {
  /** Seconds a flight takes when its shot names no duration. */
  flight: number;
  /** Seconds a shot holds when it names no hold. */
  hold: number;
  /** Pace: 2 halves every flight and hold, 0.5 doubles them. */
  speed: number;
  /** 0 flies every shot exactly as written; 1 spreads angles, distance and timing widely. */
  variance: number;
  /**
   * The spread of flight and hold lengths alone, 0..1; the `variance` given, by default. 0 keeps
   * every loop the same length (a camera timed to music), while angles and distances still vary.
   */
  timeVariance: number;
  /**
   * The shot a sequence opens on at each start, by index (e.g. the one whose cue the music is
   * nearest); undefined, or out of range, opens on the shot after the one nearest the camera.
   */
  opening?: () => number | undefined;
  /** Orbit rate, rad/s: the camera keeps turning at it through flights and holds alike. */
  drift: number;
  /** Slow rise and fall of the tilt, radians either way (a third of it in roll); 0 for none. */
  sway: number;
  /** Hold push, as a fraction of the distance. */
  creep: number;
  /** `sequence` runs the shots in order and wraps; `shuffle` never shows the same shot twice running. */
  order: "sequence" | "shuffle";
  /**
   * A fresh start cuts to the opening shot (the host shows it behind a curtain): the camera
   * begins landed on it, the flight's length given to its hold so the loop keeps its timing.
   * Off, every start flies to it from the camera's pose. A resume after a pause always flies.
   */
  cut: boolean;
  /** Inclination bounds the variance keeps to, radians. */
  inclination: { min: number; max: number };
  /** The source of variance; `Math.random` by default. */
  random: () => number;
  /** While it matches, flights cut to their shot and holds stand still. */
  reduceMotion?: { matches: boolean };
  /**
   * The hold's orbit rate for a shot, rad/s, from the pose it landed on (e.g. a camera riding
   * orbiting gas turns at the gas's rate there); undefined keeps the shot's own `drift`.
   */
  holdDrift?: (landed: Readonly<DriftPose>, shot: DriftPoseShot) => number | undefined;
};

export const DRIFT_DEFAULTS: Omit<DriftSettings, "random" | "reduceMotion"> = {
  flight: 20,
  hold: 12,
  speed: 1,
  variance: 0.3,
  timeVariance: 0.3,
  drift: 0.01,
  sway: 0.035,
  creep: 0.05,
  order: "sequence",
  cut: false,
  inclination: { min: -1.45, max: 1.45 },
};

/** How far a full variance (1) spreads each quantity. */
const SPREAD = { azimuth: 0.5, inclination: 0.2, distance: 0.3, time: 0.35 };
/** Seconds the orbit takes to ease to a new rate. */
const DRIFT_RAMP = 3;
/** Seconds per sway of the tilt and of the roll; unrelated, so the two never fall into step. */
const SWAY_PERIOD = { inclination: 47, roll: 61 };
/** Looking straight at the aim. */
const AT_AIM: FreeLook = { yaw: 0, pitch: 0 };

export type DriftCamera = ReturnType<typeof createDriftCamera>;

export function createDriftCamera(
  shots: readonly DriftShot[],
  options: Partial<DriftSettings> = {},
) {
  if (!shots.length) throw new Error("Drift needs at least one shot");
  const settings: DriftSettings = {
    ...DRIFT_DEFAULTS,
    random: Math.random,
    ...options,
    timeVariance: options.timeVariance ?? options.variance ?? DRIFT_DEFAULTS.timeVariance,
  };
  const spread = () => (settings.random() * 2 - 1) * settings.variance;
  const spreadTime = () => (settings.random() * 2 - 1) * settings.timeVariance;
  const instant = () => settings.reduceMotion?.matches === true;

  const copy = (p: DriftPose): DriftPose => ({ ...p, look: { ...p.look } });
  /** The camera drawn: `base` turned by the running orbit and swayed. */
  const pose: DriftPose = {
    azimuth: 0,
    inclination: 0,
    distance: 1,
    roll: 0,
    look: { ...AT_AIM },
    ride: 0,
  };
  /** The pose the flights and holds fly, before the orbit and the sway. */
  const base: DriftPose = copy(pose);
  /* The running orbit: its angle, rate (rad/s) and direction (that of the first flight). */
  let turn = 0;
  let spin = 0;
  let turning = 0;
  /** Seconds of motion so far, the sway's clock. */
  let clock = 0;
  /* The shot flown to (by index), the varied flight to it and what the hold does there. */
  let index = -1;
  /** The shot is the host's: nothing moves until `resume`. */
  let handoff = false;
  let from: DriftPose = copy(pose);
  let target: OrbitFlight & { roll: number; look: FreeLook; ride: number } = {
    yaw: 0,
    inclination: 0,
    distance: 1,
    roll: 0,
    look: { ...AT_AIM },
    ride: 0,
  };
  let duration = 1;
  let hold = 0;
  let drift = 0;
  let creep = 0;
  /* Flight progress 0..1, then the pose landed on and the seconds held there. */
  let t = 1;
  let landed: DriftPose = copy(pose);
  let held = 0;
  /** The opening's reveal under way: the look it turns from, and its rest and turn in seconds. */
  let unveiling: { from: FreeLook; rest: number; turn: number } | null = null;

  const wave = (period: number) => Math.sin((clock / period) * Math.PI * 2);
  /** The pose drawn from `base`, the orbit and the sway. */
  function show() {
    const { min, max } = settings.inclination;
    pose.azimuth = base.azimuth + turn;
    pose.inclination = clamp(
      base.inclination + settings.sway * wave(SWAY_PERIOD.inclination),
      min,
      max,
    );
    pose.distance = base.distance;
    pose.roll = base.roll + (settings.sway / 3) * wave(SWAY_PERIOD.roll);
    pose.look.yaw = base.look.yaw;
    pose.look.pitch = base.look.pitch;
    pose.ride = base.ride;
  }
  /** Takes over a camera at `current`: the base that draws exactly it now. */
  function adopt(current: AimedPose) {
    base.azimuth = current.azimuth - turn;
    base.inclination = current.inclination - settings.sway * wave(SWAY_PERIOD.inclination);
    base.distance = current.distance;
    base.roll = (current.roll ?? 0) - (settings.sway / 3) * wave(SWAY_PERIOD.roll);
    base.look.yaw = current.look?.yaw ?? 0;
    base.look.pitch = current.look?.pitch ?? 0;
    base.ride = current.ride ?? 0;
    show();
  }

  /**
   * The next shot: in order after the current one (first, the flown shot after the one nearest
   * the camera, in log distance and then heading), or, shuffling, any other.
   */
  function pick(): number {
    if (shots.length === 1) return 0;
    if (settings.order === "shuffle") {
      if (index < 0) return Math.floor(settings.random() * shots.length);
      const next = Math.floor(settings.random() * (shots.length - 1));
      return next >= index ? next + 1 : next;
    }
    if (index >= 0) return (index + 1) % shots.length;
    let nearest = 0;
    let gap = Infinity;
    shots.forEach((shot, i) => {
      if ("handoff" in shot) return;
      const d =
        Math.abs(Math.log(shot.distance / pose.distance)) +
        Math.abs(wrapSigned(shot.azimuth - pose.azimuth, Math.PI * 2)) / (Math.PI * 2);
      if (d < gap) {
        gap = d;
        nearest = i;
      }
    });
    /* A drift opens with a flight, not with a shot handed straight to the host. */
    let next = (nearest + 1) % shots.length;
    for (let i = 0; i < shots.length && "handoff" in shots[next]!; i++)
      next = (next + 1) % shots.length;
    return next;
  }

  function aim(next: number) {
    index = next;
    unveiling = null;
    const shot = shots[next]!;
    if ("handoff" in shot) {
      handoff = true;
      t = 1;
      held = 0;
      return;
    }
    handoff = false;
    /* The orbit so far becomes part of the base, so it never piles up across shots. */
    base.azimuth += turn;
    turn = 0;
    from = copy(base);
    const inclination = clamp(
      shot.inclination + SPREAD.inclination * spread(),
      settings.inclination.min,
      settings.inclination.max,
    );
    target = {
      yaw: wrapSigned(shot.azimuth + SPREAD.azimuth * spread() - from.azimuth, Math.PI * 2),
      inclination,
      distance: shot.distance * Math.exp(SPREAD.distance * spread()),
      roll: shot.roll ?? 0,
      look: { ...(shot.look ?? AT_AIM) },
      ride: shot.ride ?? 0,
      ...(shot.flight?.lift !== undefined ? { lift: shot.flight.lift } : {}),
      ...(shot.flight?.swing !== undefined ? { swing: shot.flight.swing } : {}),
      ...(shot.flight?.lead !== undefined ? { lead: shot.flight.lead } : {}),
    };
    const pace = Math.max(0.05, settings.speed);
    duration = Math.max(
      0.4,
      ((shot.flight?.duration ?? settings.flight) * (1 + SPREAD.time * spreadTime())) / pace,
    );
    hold = Math.max(0, ((shot.hold ?? settings.hold) * (1 + SPREAD.time * spreadTime())) / pace);
    turning ||= Math.sign(target.yaw) || 1;
    drift = shot.drift ?? settings.drift * turning;
    creep = shot.creep ?? settings.creep;
    t = 0;
    held = 0;
  }

  /**
   * Skips the flight just aimed: the camera stands where it would land, the flight's length
   * given to the hold, and the hold's orbit eases in from rest as it would after landing.
   */
  function land() {
    const at = sampleOrbitFlight(1, from, target);
    base.azimuth = at.azimuth;
    base.inclination = at.inclination;
    base.distance = at.distance;
    base.roll = target.roll;
    base.look.yaw = target.look.yaw;
    base.look.pitch = target.look.pitch;
    base.ride = target.ride;
    hold += duration;
    t = 1;
    landed = copy(base);
    held = 0;
    const shot = shots[index];
    if (shot && !("handoff" in shot)) {
      drift = settings.holdDrift?.(landed, shot) ?? drift;
      /* The reveal starts the hold looking away; the landed pose keeps the shot's own look. */
      if (shot.unveil && !instant()) {
        unveiling = {
          from: { ...shot.unveil.look },
          rest: shot.unveil.rest,
          turn: shot.unveil.turn,
        };
        base.look.yaw = shot.unveil.look.yaw;
        base.look.pitch = shot.unveil.look.pitch;
      }
    }
    show();
  }

  return {
    /** The shot being flown to or held, or -1 before `start`. */
    get index() {
      return index;
    },
    /** A flight is under way. */
    get flying() {
      return index >= 0 && t < 1;
    },
    /** The current shot is the host's to fly (`DriftHandoff`); `resume` moves on. */
    get handoff() {
      return handoff;
    },
    /** The camera this frame; read it, never write it. */
    get pose(): Readonly<DriftPose> {
      return pose;
    },
    /**
     * Begins (or begins again) from the camera's pose: the first flight starts at once, to the
     * settings' `opening` shot when it names one. With `cut` (the settings' by default) the
     * camera begins landed on that shot instead, its hold under way.
     */
    start(current: AimedPose, options: { cut?: boolean } = {}) {
      turn = 0;
      spin = 0;
      turning = 0;
      clock = 0;
      adopt(current);
      index = -1;
      const opening = settings.opening?.();
      const open = opening !== undefined && opening >= 0 && opening < shots.length ? opening : -1;
      aim(open >= 0 && !("handoff" in shots[open]!) ? open : pick());
      if (options.cut ?? settings.cut) land();
    },
    /** The host has flown its shot: goes on to the next from the camera's pose. */
    resume(current: AimedPose) {
      if (!handoff) return;
      adopt(current);
      aim(pick());
    },
    /** Advances `dt` seconds. `landed` is true on the one frame a flight ends. */
    step(dt: number): { pose: Readonly<DriftPose>; landed: boolean } {
      if (index < 0 || handoff) return { pose, landed: false };
      const flying = t < 1;
      if (!instant()) {
        /* The orbit eases toward the hold's rate, or the running rate in flight, never to rest. */
        const rate = flying ? settings.drift * turning : drift;
        spin += (rate - spin) * (1 - Math.exp(-dt / DRIFT_RAMP));
        turn += spin * dt;
        clock += dt;
      }
      if (flying) {
        t = instant() ? 1 : Math.min(1, t + dt / duration);
        const at = sampleOrbitFlight(t, from, target);
        base.azimuth = at.azimuth;
        base.inclination = at.inclination;
        base.distance = at.distance;
        const e = smootherstep(t);
        base.roll = lerp(from.roll, target.roll, e);
        base.look.yaw = lerp(from.look.yaw, target.look.yaw, e);
        base.look.pitch = lerp(from.look.pitch, target.look.pitch, e);
        base.ride = lerp(from.ride, target.ride, e);
        show();
        if (t < 1) return { pose, landed: false };
        landed = copy(base);
        const shot = shots[index];
        if (shot && !("handoff" in shot)) drift = settings.holdDrift?.(landed, shot) ?? drift;
        held = 0;
        return { pose, landed: true };
      }
      held += dt;
      if (!instant()) {
        /* The push eases over the whole hold. */
        const along = hold > 0 ? Math.min(1, held / hold) : 1;
        base.distance = landed.distance * (1 - creep * smootherstep(along));
      }
      if (unveiling) {
        /* The reveal: at rest on the look away, then one slow turn onto the shot's look. */
        const { from, rest, turn } = unveiling;
        const e = smootherstep(clamp((held - rest) / Math.max(turn, 1e-3), 0, 1));
        base.look.yaw = lerp(from.yaw, landed.look.yaw, e);
        base.look.pitch = lerp(from.pitch, landed.look.pitch, e);
        if (e >= 1 || instant()) {
          base.look.yaw = landed.look.yaw;
          base.look.pitch = landed.look.pitch;
          unveiling = null;
        }
      }
      show();
      if (held >= hold) aim(pick());
      return { pose, landed: false };
    },
    /** Stops; the next `start` begins afresh. */
    reset() {
      index = -1;
      t = 1;
      handoff = false;
    },
  };
}

export type DriftRunState = "off" | "playing" | "paused";

export type DriftRun = ReturnType<typeof createDriftRun>;

/**
 * A drift as a host runs it, frame by frame, from its on/off/paused state: the camera starts
 * flying from wherever the host's camera is on the first playing frame (and again after a
 * pause), leaves it alone while paused or handed off, and resets when the drift ends. With the
 * settings' `cut`, a start from off cuts to the opening shot (the host's curtain covers it); a
 * start after a pause flies from the visitor's camera. Pure, so a raymarched scene and an
 * orbit rig share it (`createRigDrift` builds on it for the rig).
 */
export function createDriftRun(shots: readonly DriftShot[], settings: Partial<DriftSettings> = {}) {
  const camera = createDriftCamera(shots, settings);
  /** The drift was on at the last step. */
  let active = false;
  /** The camera is flying the drift now. */
  let flying = false;
  /** The next start is a fresh one, from off (it may cut); after a pause it flies. */
  let fresh = true;

  return {
    camera,
    get flying() {
      return flying;
    },
    /**
     * Each frame: the pose to draw (null leaves the camera as it is), whether the camera has
     * just started flying (from `current`), whether the drift has just ended (the host gives the
     * camera back where it stopped), and whether the shot is the host's own (`handoff`; it calls
     * `camera.resume` when done). `hold` keeps the drift from starting or flying while something
     * else owns the camera.
     */
    step(state: DriftRunState, current: AimedPose, dt: number, hold = false) {
      const ended = active && state === "off";
      active = state !== "off";
      if (state === "off") fresh = true;
      else if (state === "paused") fresh = false;
      const result = {
        pose: null as Readonly<DriftPose> | null,
        started: false,
        ended,
        handoff: false,
      };
      if (state !== "playing" || hold) {
        if (ended) camera.reset();
        flying = false;
        return result;
      }
      if (!flying) {
        flying = true;
        result.started = true;
        camera.start(current, { cut: (settings.cut ?? false) && fresh });
        fresh = false;
      }
      if (camera.handoff) {
        result.handoff = true;
        return result;
      }
      result.pose = camera.step(dt).pose;
      return result;
    },
  };
}
