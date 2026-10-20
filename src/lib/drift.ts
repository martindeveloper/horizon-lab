/**
 * Drift: the lean-back mode. The scene enters immersive view, the music lifts (and may change
 * to the simulation's own track), and the camera flies itself from shot to shot until the
 * visitor takes it, pauses it or leaves. Each simulation describes its drift in
 * `src/features/<slug>/lib/drift.ts` as a `DriftProgramme`; the shared pieces here hold the
 * state every store carries and the shape of that programme. No React, no renderer.
 */
import { cueTime, type AudioMap } from "@horizon/toolkit/audio";
import type { DriftRunState, DriftSettings } from "@horizon/toolkit/camera";

/** `loading`: the drift is on and its loader shows while its music and map come; then it plays. */
export type DriftState = "off" | "loading" | "playing" | "paused";

/** The state a drift camera runs in: a loading drift is not flying yet. */
export const driftRunState = (state: DriftState): DriftRunState =>
  state === "loading" ? "off" : state;

/** Seconds a drift's loader shows at least, so it never flashes, and at most, so a stall never holds it. */
export const DRIFT_LOADING = { minimum: 1.4, timeout: 10 };

/**
 * Whether a loading drift may begin: after the loader's minimum, once its map has settled
 * (loaded or failed, either way decided) and its music is audible or off; at the timeout
 * regardless, so a stalled network never holds the drift.
 */
export function driftReady(
  status: { map: "loading" | "settled"; music: "off" | "buffering" | "audible"; elapsed: number },
  limits = DRIFT_LOADING,
) {
  if (status.elapsed >= limits.timeout) return true;
  if (status.elapsed < limits.minimum) return false;
  return status.map === "settled" && status.music !== "buffering";
}

/** What the music does while a drift is on. */
export type DriftMusic = {
  /** The ambient playlist track (by title) the drift holds on; the playlist runs on without it. */
  track?: string;
  /** Level 0..1 while drifting; the drift level by default. */
  level?: number;
  /**
   * Seconds the track plays before it loops (its length less the player's crossfade), when the
   * camera's loop is timed to it: the programme's flights and holds then add up to this, times
   * `loops`.
   */
  period?: number;
  /** Plays of the track one loop of the camera spans; 1 by default. A cue in a later play is `peak@2`. */
  loops?: number;
};

/**
 * A shot timed to the music: its flight begins (`at`) or lands (`land`) on the named cue of the
 * track's audio map (`AudioMap.cues`, e.g. `rise`, `breath-2`, `peak`; `peak@2` in the track's
 * second play, for a camera loop spanning several). The flight and hold it is written with
 * stand when there is no map or no such cue.
 */
export type CuedShot = { at?: string; land?: string };

/** Seconds into the camera loop of the cue `id`, read from `map` with its play (`peak@2`). */
function cueAt(map: AudioMap, id: string) {
  const [name, play] = id.split("@");
  const at = cueTime(map, name ?? id);
  if (at === undefined) return undefined;
  const plays = play === undefined ? 1 : Number(play);
  return Number.isInteger(plays) && plays >= 1 ? at + (plays - 1) * map.period : undefined;
}

/** A hold shorter than this, seconds, means the cues are too close: the shots keep their own timing. */
const MIN_HOLD = 2;

/**
 * The shots of a programme timed to a map: the hold of the shot before each cued shot
 * stretches or shrinks so the cued shot meets its cue, and the last cued shot's own hold runs
 * to the loop's end, the map's period; every other length stands as written. A cue the map
 * lacks, or cues too close for the flights between them, leave that stretch as written.
 * Returns the shots to fly and the loop's length.
 */
export function timeShots<
  Shot extends CuedShot & { flight?: { duration?: number }; hold?: number },
>(programme: DriftProgramme<Shot>, map: AudioMap | null): { shots: Shot[]; period: number } {
  const shots = programme.shots.map((shot) => ({ ...shot }));
  const flight = (shot: Shot) => shot.flight?.duration ?? programme.camera.flight ?? 20;
  const hold = (shot: Shot) => shot.hold ?? programme.camera.hold ?? 12;
  /* A handoff shot is the host's to fly: it adds no length of its own. */
  const length = (shot: Shot) => ("handoff" in shot ? 0 : flight(shot) + hold(shot));
  const written = shots.reduce((sum, shot) => sum + length(shot), 0);
  const loops = programme.music?.loops ?? 1;
  if (!map)
    return {
      shots,
      period: programme.music?.period === undefined ? written : programme.music.period * loops,
    };
  const period = map.period * loops;
  /* When a cued shot's flight begins: on its cue, or a flight's length before the cue it lands on. */
  const cueStart = (shot: Shot) => {
    const at = shot.at !== undefined ? cueAt(map, shot.at) : undefined;
    if (at !== undefined) return at;
    const land = shot.land !== undefined ? cueAt(map, shot.land) : undefined;
    return land !== undefined ? land - flight(shot) : undefined;
  };
  const round = (seconds: number) => Math.round(seconds * 10) / 10;
  let t = 0;
  let last: { i: number; start: number } | null = null;
  shots.forEach((shot, i) => {
    const start = cueStart(shot);
    if (start !== undefined) {
      const prev = shots[i - 1];
      if (prev) {
        const stretched = hold(prev) + (start - t);
        if (stretched >= MIN_HOLD) {
          prev.hold = round(stretched);
          t = start;
        }
      }
      last = { i, start: t };
    }
    t += length(shot);
  });
  if (last) {
    const { i, start } = last as { i: number; start: number };
    let after = 0;
    for (let j = i + 1; j < shots.length; j++) after += length(shots[j]!);
    const closing = period - start - flight(shots[i]!) - after;
    if (closing >= MIN_HOLD) shots[i]!.hold = round(closing);
  }
  return { shots, period };
}

/** A simulation's drift: its music, the camera's pace and spread, and the shots it flies. */
export type DriftProgramme<Shot> = {
  music?: DriftMusic;
  camera: Partial<Omit<DriftSettings, "random" | "reduceMotion">>;
  shots: readonly Shot[];
};

/** A programme timed to its track's map (or as written, without one): its shots, loop and cues. */
export type TimedDrift<Shot extends CuedShot & { flight?: { duration?: number }; hold?: number }> =
  ReturnType<typeof timedDrift<Shot>>;

export function timedDrift<
  Shot extends CuedShot & { flight?: { duration?: number }; hold?: number },
>(programme: DriftProgramme<Shot>, map: AudioMap | null) {
  const { shots, period } = timeShots(programme, map);
  /* When each shot's flight begins, seconds into the loop. */
  const starts: number[] = [];
  let at = 0;
  for (const shot of shots) {
    starts.push(at);
    if ("handoff" in shot) continue;
    at +=
      (shot.flight?.duration ?? programme.camera.flight ?? 20) +
      (shot.hold ?? programme.camera.hold ?? 12);
  }
  /* Seconds of one play of the track: the loop holds `music.loops` of them. */
  const play = period / (programme.music?.loops ?? 1);
  return { programme, shots, period, play, starts, loop: at };
}

/**
 * The shot to open a drift on so the camera meets its music: the one whose cue is nearest
 * `position` seconds into the track (null, no music: the first). A loop spanning several plays
 * of the track picks across them; the earliest wins a tie.
 */
export function openingFor(
  timed: { starts: readonly number[]; period: number; play: number },
  position: number | null,
) {
  if (position === null) return 0;
  const { starts, period, play } = timed;
  if (period <= 0 || play <= 0) return 0;
  const at = ((position % play) + play) % play;
  /* How far a start lies from the music's moment within its play, either way round. */
  const apart = (start: number) => {
    const d = Math.abs((start % play) - at);
    return Math.min(d, play - d);
  };
  let best = 0;
  let gap = apart(0);
  starts.forEach((start, i) => {
    const d = apart(start);
    if (d < gap) {
      gap = d;
      best = i;
    }
  });
  return best;
}

export type DriftSlice = {
  drift: DriftState;
  /** Begins the drift: its loader shows while its music and map come (`readyDrift` then flies). */
  startDrift: () => void;
  /** The drift's music and map are ready: the camera flies from where it is. */
  readyDrift: () => void;
  /** The camera is the visitor's for now; the music stays. */
  pauseDrift: () => void;
  /** Flies on from wherever the camera is. */
  resumeDrift: () => void;
  toggleDrift: () => void;
  stopDrift: () => void;
};

/**
 * The drift's machine, the same in every simulation: `open` clears what stands in the way as
 * the drift starts (a guide, panels, a close-up) and may call the store's own actions; `close`
 * sets things back when the drift ends. Both run before the drift's own state is written. A
 * drift starts `loading` and plays once the immersive view says it is ready.
 */
export function driftSlice<S extends DriftSlice>(
  set: NoInfer<(patch: (state: S) => Partial<S>) => void>,
  get: () => S,
  hooks: {
    open?: (state: S) => Partial<S>;
    close?: (state: S) => Partial<S>;
  } = {},
): DriftSlice {
  const patch = (fields: object) => fields as Partial<S>;
  return {
    drift: "off",
    startDrift: () => {
      if (get().drift !== "off") return;
      const opened = hooks.open?.(get());
      set(() => patch({ drift: "loading", ...opened }));
    },
    readyDrift: () => {
      if (get().drift === "loading") set(() => patch({ drift: "playing" }));
    },
    pauseDrift: () => {
      if (get().drift === "playing") set(() => patch({ drift: "paused" }));
    },
    resumeDrift: () => {
      if (get().drift === "paused") set(() => patch({ drift: "playing" }));
    },
    toggleDrift: () => {
      const s = get();
      if (s.drift === "playing") s.pauseDrift();
      else if (s.drift === "paused") s.resumeDrift();
    },
    stopDrift: () => {
      if (get().drift === "off") return;
      const closed = hooks.close?.(get());
      set(() => patch({ drift: "off", ...closed }));
    },
  };
}
