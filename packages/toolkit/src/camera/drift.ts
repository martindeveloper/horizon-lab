/**
 * Drift: a camera that flies itself, for as long as it is left alone. It takes a list of shots
 * and goes from one to the next: a long flight (`sampleOrbitFlight`, log-linear in distance, so
 * a zoom across scales keeps an even pace), then a hold with a slow orbit and a gentle push,
 * then the next shot. Variance jitters each shot's angles, distance and timing, so no two
 * passes look alike. Pure: no rig, no renderer; a host assigns the pose to its own camera. A
 * shot the host flies itself (a close-up on its own rig) is a handoff: the camera waits there
 * until the host says `resume`.
 */
import { clamp, lerp, smootherstep, wrapSigned } from "../math";
import { sampleOrbitFlight, type OrbitFlight, type OrbitPose } from "./flight";

export type DriftPose = OrbitPose & { roll: number };

/** A shot the host flies itself: the camera leaves the pose alone until `resume`. */
export type DriftHandoff = { handoff: true };

/** Where a drift goes, and how it gets there and waits. */
export type DriftShot = DriftHandoff | DriftPoseShot;

export type DriftPoseShot = OrbitPose & {
  /** Dutch tilt at the shot, radians; 0 by default. */
  roll?: number;
  /** Flight shaping (see `sampleOrbitFlight`) and its length in seconds. */
  flight?: Pick<OrbitFlight, "lift" | "swing" | "lead"> & { duration?: number };
  /** Seconds the shot holds once landed, before the next flight. */
  hold?: number;
  /** Slow orbit while held, rad/s; by default the settings' rate, the way the flight turned. */
  drift?: number;
  /** Fraction of the distance pushed in (+) or out (−) over the hold. */
  creep?: number;
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
  /** Hold orbit rate, rad/s. */
  drift: number;
  /** Hold push, as a fraction of the distance. */
  creep: number;
  /** `sequence` runs the shots in order and wraps; `shuffle` never shows the same shot twice running. */
  order: "sequence" | "shuffle";
  /** Inclination bounds the variance keeps to, radians. */
  inclination: { min: number; max: number };
  /** The source of variance; `Math.random` by default. */
  random: () => number;
  /** While it matches, flights cut to their shot and holds stand still. */
  reduceMotion?: { matches: boolean };
};

export const DRIFT_DEFAULTS: Omit<DriftSettings, "random" | "reduceMotion"> = {
  flight: 20,
  hold: 12,
  speed: 1,
  variance: 0.3,
  drift: 0.01,
  creep: 0.05,
  order: "sequence",
  inclination: { min: -1.45, max: 1.45 },
};

/** How far a full variance (1) spreads each quantity. */
const SPREAD = { azimuth: 0.5, inclination: 0.2, distance: 0.3, time: 0.35 };
/** Seconds the hold's orbit takes to reach its full rate. */
const DRIFT_RAMP = 3;

export type DriftCamera = ReturnType<typeof createDriftCamera>;

export function createDriftCamera(
  shots: readonly DriftShot[],
  options: Partial<DriftSettings> = {},
) {
  if (!shots.length) throw new Error("Drift needs at least one shot");
  const settings: DriftSettings = { ...DRIFT_DEFAULTS, random: Math.random, ...options };
  const spread = () => (settings.random() * 2 - 1) * settings.variance;
  const instant = () => settings.reduceMotion?.matches === true;

  const pose: DriftPose = { azimuth: 0, inclination: 0, distance: 1, roll: 0 };
  /* The shot flown to (by index), the varied flight to it and what the hold does there. */
  let index = -1;
  /** The shot is the host's: nothing moves until `resume`. */
  let handoff = false;
  let from: DriftPose = { ...pose };
  let target: OrbitFlight & { roll: number } = { yaw: 0, inclination: 0, distance: 1, roll: 0 };
  let duration = 1;
  let hold = 0;
  let drift = 0;
  let creep = 0;
  /* Flight progress 0..1, then the pose landed on and the seconds held there. */
  let t = 1;
  let landed: DriftPose = { ...pose };
  let held = 0;

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
    const shot = shots[next]!;
    if ("handoff" in shot) {
      handoff = true;
      t = 1;
      held = 0;
      return;
    }
    handoff = false;
    from = { ...pose };
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
      ...(shot.flight?.lift !== undefined ? { lift: shot.flight.lift } : {}),
      ...(shot.flight?.swing !== undefined ? { swing: shot.flight.swing } : {}),
      ...(shot.flight?.lead !== undefined ? { lead: shot.flight.lead } : {}),
    };
    const pace = Math.max(0.05, settings.speed);
    duration = Math.max(
      0.4,
      ((shot.flight?.duration ?? settings.flight) * (1 + SPREAD.time * spread())) / pace,
    );
    hold = Math.max(0, ((shot.hold ?? settings.hold) * (1 + SPREAD.time * spread())) / pace);
    drift = shot.drift ?? settings.drift * (Math.sign(target.yaw) || 1);
    creep = shot.creep ?? settings.creep;
    t = 0;
    held = 0;
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
    /** Begins (or begins again) from the camera's pose: the first flight starts at once. */
    start(current: OrbitPose & { roll?: number }) {
      pose.azimuth = current.azimuth;
      pose.inclination = current.inclination;
      pose.distance = current.distance;
      pose.roll = current.roll ?? 0;
      index = -1;
      aim(pick());
    },
    /** The host has flown its shot: goes on to the next from the camera's pose. */
    resume(current: OrbitPose & { roll?: number }) {
      if (!handoff) return;
      pose.azimuth = current.azimuth;
      pose.inclination = current.inclination;
      pose.distance = current.distance;
      pose.roll = current.roll ?? 0;
      aim(pick());
    },
    /** Advances `dt` seconds. `landed` is true on the one frame a flight ends. */
    step(dt: number): { pose: Readonly<DriftPose>; landed: boolean } {
      if (index < 0 || handoff) return { pose, landed: false };
      if (t < 1) {
        t = instant() ? 1 : Math.min(1, t + dt / duration);
        const at = sampleOrbitFlight(t, from, target);
        pose.azimuth = at.azimuth;
        pose.inclination = at.inclination;
        pose.distance = at.distance;
        pose.roll = lerp(from.roll, target.roll, smootherstep(t));
        if (t < 1) return { pose, landed: false };
        landed = { ...pose };
        held = 0;
        return { pose, landed: true };
      }
      held += dt;
      if (!instant()) {
        /* The orbit eases up to its rate; the push eases over the whole hold. */
        pose.azimuth =
          landed.azimuth + drift * (held - DRIFT_RAMP * (1 - Math.exp(-held / DRIFT_RAMP)));
        const along = hold > 0 ? Math.min(1, held / hold) : 1;
        pose.distance = landed.distance * (1 - creep * smootherstep(along));
      }
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
 * pause), leaves it alone while paused or handed off, and resets when the drift ends. Pure, so
 * a raymarched scene and an orbit rig share it (`createRigDrift` builds on it for the rig).
 */
export function createDriftRun(shots: readonly DriftShot[], settings: Partial<DriftSettings> = {}) {
  const camera = createDriftCamera(shots, settings);
  /** The drift was on at the last step. */
  let active = false;
  /** The camera is flying the drift now. */
  let flying = false;

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
    step(state: DriftRunState, current: OrbitPose & { roll?: number }, dt: number, hold = false) {
      const ended = active && state === "off";
      active = state !== "off";
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
        camera.start(current);
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
