/**
 * The drift's camera on the ladder, without the DOM, at each moment of a loop of the programme
 * timed to its track (`timedDrift`). Each shot holds about its body, creeping up the ladder
 * through it; between holds the camera flies on up. The keys are the holds' ends, each a place
 * on the ladder and a surface zoom.
 *
 * The camera does not move by rungs between them: neighbouring bodies differ in size by
 * anything from a few per cent to ninety times, and the ladder zooms about each body in turn,
 * so a flight measured in rungs lurches and kinks wherever it passes one. It flies instead the
 * smooth zoom and pan between the keys' framings (`zoomPath`), at an even pace as the eye sees
 * it: one monotone cubic (Fritsch–Carlson) through the distance flown, key by key, so the
 * camera never turns back or stops, slows into each hold at the hold's creep and leaves at it.
 * The surface zoom eases the same way in log space, flat through each hold, about the body
 * nearest. The first shot's flight is spent at its own body as the scene comes out of the
 * seam's black (`seamLight`), so the climb starts again unseen rather than flying back down.
 */
import { seamLight, type TimedDrift } from "@/lib/drift";
import { wrap } from "@horizon/toolkit/math";

import type { GiantsDriftShot } from "../drift";
import { cameraAt, placeAtScale, type Ladder, type Stage } from "./ladder";
import { rungIndex } from "./rungs";

/** The drift's camera at a moment of its loop. */
export type DriftFrame = {
  /** The ladder's framing before the surface zoom: metres per CSS pixel, and the horizon's point under the stage's middle. */
  scale: number;
  centre: number;
  /** The place on the ladder that scale is, and the surface zoom about the body nearest it. */
  place: number;
  zoom: number;
  /** The rung the shot under way flies to or holds at: the star that comes alive. */
  heading: number;
  /** How lit the scene is, 0 on the loop's seam (`seamLight`). */
  light: number;
};

export const blankDriftFrame = (): DriftFrame => ({
  scale: 1,
  centre: 0,
  place: 0,
  zoom: 1,
  heading: 0,
  light: 1,
});

/** A framing as the smooth zoom flies it: the horizon's point in the middle, and the width in view, metres. */
export type Framing = { centre: number; width: number };

/**
 * How much a smooth zoom favours zooming over panning (van Wijk and Nuij's ρ): √2, their
 * measured optimum, is the pace a viewer reads as steady.
 */
const ZOOM_PAN = Math.SQRT2;

/** The ends of van Wijk and Nuij's path for a pan of `d` between widths `w0` and `w1` at `rho`: its parameters and length. */
function smoothZoom(w0: number, w1: number, d: number, rho: number) {
  const rho2 = rho * rho;
  const b0 = (w1 * w1 - w0 * w0 + rho2 * rho2 * d * d) / (2 * w0 * rho2 * d);
  const b1 = (w1 * w1 - w0 * w0 - rho2 * rho2 * d * d) / (2 * w1 * rho2 * d);
  const r0 = -Math.asinh(b0);
  const r1 = -Math.asinh(b1);
  return { r0, length: (r1 - r0) / rho };
}

/**
 * The smooth zoom and pan from one framing to another (van Wijk and Nuij, "Smooth and
 * efficient zooming and panning", 2003): the path a viewer perceives as shortest, its
 * `length` in their measure at ρ = √2 (so lengths compare across paths) and `at(f)` the
 * framing a fraction `f` along it. The climb never zooms back in, so where the optimal path
 * would rise past the wider framing and fall back to it, the path leans to panning (a lower
 * ρ) just enough to land on it without turning back.
 */
export function zoomPath(from: Framing, to: Framing) {
  const w0 = from.width;
  const w1 = to.width;
  const d = Math.abs(to.centre - from.centre);
  const direction = Math.sign(to.centre - from.centre);
  const grow = Math.log(w1 / w0);
  if (d < 1e-9 * Math.max(w0, w1)) {
    return {
      length: Math.abs(grow) / ZOOM_PAN,
      at: (f: number): Framing => ({ centre: from.centre, width: w0 * Math.exp(grow * f) }),
    };
  }
  /* Past ρ⁴d² = |w1² − w0²| the widest framing would lie between the two. */
  const rho = Math.max(1e-3, Math.min(ZOOM_PAN, (Math.abs(w1 * w1 - w0 * w0) / (d * d)) ** 0.25));
  const rho2 = rho * rho;
  const { r0, length } = smoothZoom(w0, w1, d, rho);
  return {
    length: smoothZoom(w0, w1, d, ZOOM_PAN).length,
    at: (f: number): Framing => {
      const s = f * length;
      const u = (w0 / (rho2 * d)) * (Math.cosh(r0) * Math.tanh(rho * s + r0) - Math.sinh(r0));
      return {
        centre: from.centre + direction * u * d,
        width: (w0 * Math.cosh(r0)) / Math.cosh(rho * s + r0),
      };
    },
  };
}

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

/** A camera on the ladder as the smooth zoom flies it: its framing. */
export const framingOf = (camera: { scale: number; centre: number }, stage: Stage): Framing => ({
  centre: camera.centre,
  width: camera.scale * stage.width,
});

export type DriftPath = ReturnType<typeof createDriftPath>;

export function createDriftPath(timed: TimedDrift<GiantsDriftShot>, ladder: Ladder) {
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
  const zoomTangents = tangents(ts, zooms);
  const last = ts.length - 1;

  /** The flights between the keys' framings on a stage, and the distance flown to each key: kept until the stage changes. */
  let flown: {
    width: number;
    height: number;
    paths: ReturnType<typeof zoomPath>[];
    distance: number[];
    tangents: number[];
  } | null = null;
  const flightsOn = (stage: Stage) => {
    if (flown?.width === stage.width && flown.height === stage.height) return flown;
    const framings = places.map((place) => framingOf(cameraAt(ladder, place, stage), stage));
    const paths = framings.slice(1).map((to, k) => zoomPath(framings[k]!, to));
    const distance = [0];
    for (const path of paths) distance.push(distance[distance.length - 1]! + path.length);
    flown = {
      width: stage.width,
      height: stage.height,
      paths,
      distance,
      tangents: tangents(ts, distance),
    };
    return flown;
  };

  return {
    loop,
    /** Seconds into the loop shot `i`'s hold begins: where a fresh start opens on it. */
    opening: (i: number) => holds[i] ?? 0,
    /**
     * The camera `t` seconds into the loop on `stage`, written into `out`. `still` (reduced
     * motion) cuts each flight to its shot and stands each hold at its start.
     */
    at(t: number, stage: Stage, still = false, out: DriftFrame = blankDriftFrame()): DriftFrame {
      const time = wrap(t, loop);
      let index = 0;
      while (index + 1 < starts.length && starts[index + 1]! <= time) index++;
      const shot = shots[index]!;
      out.heading = rungIndex(shot.rung);
      out.light = seamLight(time, loop, programme.fade);
      if (still) {
        out.place = out.heading + shot.creep[0];
        out.zoom = shot.zoom ?? 1;
        const camera = cameraAt(ladder, out.place, stage);
        out.scale = camera.scale;
        out.centre = camera.centre;
        return out;
      }
      const at = Math.min(ts[last]!, Math.max(ts[0]!, time));
      let k = 0;
      while (k + 1 < last && ts[k + 1]! <= at) k++;
      const span = (ys: readonly number[], ms: readonly number[]) =>
        hermite(ts[k]!, ts[k + 1]!, ys[k]!, ys[k + 1]!, ms[k]!, ms[k + 1]!, at);
      const { paths, distance, tangents: pace } = flightsOn(stage);
      const leg = distance[k + 1]! - distance[k]!;
      const framing = paths[k]!.at(leg > 0 ? (span(distance, pace) - distance[k]!) / leg : 0);
      out.scale = framing.width / stage.width;
      out.centre = framing.centre;
      out.place = placeAtScale(ladder, out.scale, stage);
      out.zoom = Math.exp(span(zooms, zoomTangents));
      return out;
    },
  };
}
