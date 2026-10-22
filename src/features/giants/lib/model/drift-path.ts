/**
 * The drift's camera on the ladder, without the DOM: where the camera is (`place`) and how far
 * the surface zoom has it at each moment of a loop, from the programme timed to its track
 * (`timedDrift`). Each shot holds about its body, creeping up the ladder through it; between
 * holds the camera flies on up. One monotone cubic (Fritsch–Carlson) runs through the holds'
 * ends, so the climb never turns back or stops: it slows into each hold at the hold's creep and
 * leaves at it. The zoom eases the same way in log space, flat through each hold. The first
 * shot's flight is spent at its own body as the scene comes out of the seam's black
 * (`seamLight`), so the climb starts again unseen rather than flying back down.
 */
import { seamLight, type TimedDrift } from "@/lib/drift";
import { wrap } from "@horizon/toolkit/math";

import type { GiantsDriftShot } from "../drift";
import { rungIndex } from "./rungs";

/** The drift's camera at a moment of its loop. */
export type DriftFrame = {
  /** The camera's place on the ladder, and the surface zoom about the body nearest it. */
  place: number;
  zoom: number;
  /** The rung the shot under way flies to or holds at: the star that comes alive. */
  heading: number;
  /** The planets' orbits round that rung. */
  orbits: boolean;
  /** How lit the scene is, 0 on the loop's seam (`seamLight`). */
  light: number;
};

export const blankDriftFrame = (): DriftFrame => ({
  place: 0,
  zoom: 1,
  heading: 0,
  orbits: false,
  light: 1,
});

/** Tangents of the monotone cubic through (`ts`, `ys`): it never overshoots a key, so never turns back. */
function tangents(ts: readonly number[], ys: readonly number[]) {
  const h = ts.slice(1).map((t, i) => t - ts[i]!);
  const d = h.map((span, i) => (ys[i + 1]! - ys[i]!) / span);
  return ts.map((_, i) => {
    const before = d[i - 1];
    const after = d[i];
    if (before === undefined || after === undefined) return before ?? after ?? 0;
    if (before * after <= 0) return 0;
    const w1 = 2 * h[i]! + h[i - 1]!;
    const w2 = h[i]! + 2 * h[i - 1]!;
    return (w1 + w2) / (w1 / before + w2 / after);
  });
}

/** The cubic Hermite from (t0, y0) leaving at m0 to (t1, y1) landing at m1, at `t`. */
function hermite(
  t0: number,
  t1: number,
  y0: number,
  y1: number,
  m0: number,
  m1: number,
  t: number,
) {
  const h = t1 - t0;
  const s = (t - t0) / h;
  const s2 = s * s;
  const s3 = s2 * s;
  return (
    (2 * s3 - 3 * s2 + 1) * y0 +
    (s3 - 2 * s2 + s) * h * m0 +
    (3 * s2 - 2 * s3) * y1 +
    (s3 - s2) * h * m1
  );
}

export type DriftPath = ReturnType<typeof createDriftPath>;

export function createDriftPath(timed: TimedDrift<GiantsDriftShot>) {
  const { shots, starts, loop, programme } = timed;
  /** Seconds into the loop each shot's hold begins; the first's at once, as the black lifts. */
  const holds = shots.map((shot, i) => (i === 0 ? starts[0]! : starts[i]! + shot.flight.duration));
  const ts: number[] = [];
  const places: number[] = [];
  const zooms: number[] = [];
  shots.forEach((shot, i) => {
    const rung = rungIndex(shot.rung);
    const zoom = Math.log(shot.zoom ?? 1);
    const keys: [number, number][] = [
      [holds[i]!, shot.creep[0]],
      [holds[i]! + (i === 0 ? shot.flight.duration : 0) + shot.hold, shot.creep[1]],
    ];
    for (const [at, creep] of keys) {
      /* A hold no longer than its flight's end shares that key. */
      if (ts.length > 0 && at - ts[ts.length - 1]! < 1e-6) {
        places[places.length - 1] = rung + creep;
        zooms[zooms.length - 1] = zoom;
      } else {
        ts.push(at);
        places.push(rung + creep);
        zooms.push(zoom);
      }
    }
  });
  const placeTangents = tangents(ts, places);
  const zoomTangents = tangents(ts, zooms);
  const last = ts.length - 1;

  return {
    loop,
    /** Seconds into the loop shot `i`'s hold begins: where a fresh start opens on it. */
    opening: (i: number) => holds[i] ?? 0,
    /**
     * The camera `t` seconds into the loop, written into `out`. `still` (reduced motion) cuts
     * each flight to its shot and stands each hold at its start.
     */
    at(t: number, still = false, out: DriftFrame = blankDriftFrame()): DriftFrame {
      const time = wrap(t, loop);
      let index = 0;
      while (index + 1 < starts.length && starts[index + 1]! <= time) index++;
      const shot = shots[index]!;
      out.heading = rungIndex(shot.rung);
      out.orbits = shot.orbits ?? false;
      out.light = seamLight(time, loop, programme.fade);
      if (still) {
        out.place = out.heading + shot.creep[0];
        out.zoom = shot.zoom ?? 1;
        return out;
      }
      const at = Math.min(ts[last]!, Math.max(ts[0]!, time));
      let k = 0;
      while (k + 1 < last && ts[k + 1]! <= at) k++;
      const span = (ys: readonly number[], ms: readonly number[]) =>
        hermite(ts[k]!, ts[k + 1]!, ys[k]!, ys[k + 1]!, ms[k]!, ms[k + 1]!, at);
      out.place = span(places, placeTangents);
      out.zoom = Math.exp(span(zooms, zoomTangents));
      return out;
    },
  };
}
