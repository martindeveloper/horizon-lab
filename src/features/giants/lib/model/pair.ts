/**
 * Side by side: any two bodies at true scale, wherever they stand on the ladder. They make a
 * ladder of their own, the smaller just left of the larger as neighbours on the ladder stand,
 * and the camera's place on it, `t` from 0 (the smaller framed) to 1 (the larger), zooms about
 * the smaller as the ladder's does between two rungs (`cameraAt`), so it stays in sight. When the
 * bodies on the stage change (into the pair, out of it, a new pair) those that stay glide to
 * their new places, those that go slide off the nearer edge and those that come slide in from
 * it: each from exactly where it was drawn, and off or on past the reach of its light (a black
 * hole's ring, a star's glow), so nothing jumps as the change starts or blinks out as it ends.
 * Without the DOM or WebGL.
 */
import { lerp, smootherstep, smoothstep } from "@horizon/toolkit/math";

import { RESTAGE_LIGHT_SHARE } from "../parameters";
import {
  blankPlaced,
  cameraAt,
  createLadder,
  placeBodiesInto,
  type Camera,
  type Ladder,
  type Placed,
  type Stage,
} from "./ladder";
import { glidePlaced } from "./overview";

/** Two rungs side by side, the smaller first. */
export type Pair = { small: number; large: number };

export const pairOf = (a: number, b: number): Pair =>
  a < b ? { small: a, large: b } : { small: b, large: a };

export const samePair = (a: Pair | null, b: Pair | null) =>
  a === b || (a !== null && b !== null && a.small === b.small && a.large === b.large);

export const pairLadder = (ladder: Ladder, pair: Pair) =>
  createLadder([ladder.sizes[pair.small]!, ladder.sizes[pair.large]!]);

/** The pair's camera at its place `t` on its own ladder, written into `camera`. */
export const pairCamera = (own: Ladder, t: number, stage: Stage, camera: Camera) =>
  cameraAt(own, t, stage, camera);

/**
 * The pair's bodies in view as `camera` sees them, written into `out` (largest first, numbered
 * by their rungs on the whole ladder); returns how many.
 */
export function placePairInto(
  out: Placed[],
  own: Ladder,
  pair: Pair,
  camera: Camera,
  stage: Stage,
) {
  const count = placeBodiesInto(out, own, camera, stage);
  for (let i = 0; i < count; i++) out[i]!.index = out[i]!.index === 0 ? pair.small : pair.large;
  return count;
}

/**
 * A body just past the stage's nearer side edge from where it is drawn, its size kept and all
 * its light (`reach` radii from its centre) beyond the edge: where a body that leaves the stage
 * goes, and one that comes onto it starts. Written into `out`.
 */
export function offstage(
  body: Placed,
  reach: number,
  stage: Stage,
  out: Placed = blankPlaced(),
): Placed {
  Object.assign(out, body);
  const beyond = body.radius * Math.max(1, reach);
  out.x = body.x < stage.width / 2 ? -beyond : stage.width + beyond;
  return out;
}

/**
 * The bodies on the stage `k` of the way (0–1, eased here) from `from`, as they were drawn when
 * the stage changed, to the first `count` of `to`, as it is now drawn: each in both glides, each
 * only in `from` slides off, each only in `to` slides on, past the reach of its light (`reachOf`
 * a rung's, radii). Written into `out` (not `from` or `to`), largest first; returns how many.
 */
export function restageInto(
  out: Placed[],
  from: readonly Placed[],
  to: readonly Placed[],
  count: number,
  k: number,
  stage: Stage,
  reachOf: (index: number) => number,
) {
  const blend = smootherstep(k);
  const shown = to.slice(0, count);
  let written = 0;
  const next = () => (out[written++] ??= blankPlaced());
  const scratch = blankPlaced();
  for (const body of shown) {
    const before = from.find((other) => other.index === body.index);
    const start = before ?? offstage(body, reachOf(body.index), stage, scratch);
    glidePlaced(start, body, blend, next());
  }
  for (const body of from)
    if (!shown.some((other) => other.index === body.index))
      glidePlaced(body, offstage(body, reachOf(body.index), stage, scratch), blend, next());
  const sorted = out.slice(0, written).sort((a, b) => b.radius - a.radius);
  sorted.forEach((body, i) => (out[i] = body));
  return written;
}

export type Role = "stays" | "leaves" | "comes";

/** A rung's role in a change from the bodies `from` to the first `count` of `to`; `null` if in neither. */
export function roleIn(
  from: readonly Placed[],
  to: readonly Placed[],
  count: number,
  index: number,
) {
  const was = from.some((body) => body.index === index);
  let is = false;
  for (let i = 0; i < count && !is; i++) is = to[i]!.index === index;
  if (was && is) {
    return "stays";
  }
  if (was) {
    return "leaves";
  }
  if (is) {
    return "comes";
  }
  return null;
}

/**
 * How much of a body's far-reaching light shows `k` (0–1) into a stage change: all of one that
 * stays; one that leaves gives it up early, before it has moved much, and one that comes takes
 * it up late, once it has nearly arrived (`RESTAGE_LIGHT_SHARE`), so a ring or a lens that
 * surrounds the view never sweeps across it.
 */
export function restageLight(role: Role, k: number) {
  if (role === "stays") return 1;
  return role === "leaves"
    ? 1 - smoothstep(0, RESTAGE_LIGHT_SHARE, k)
    : smoothstep(1 - RESTAGE_LIGHT_SHARE, 1, k);
}

/**
 * A hole's lensing `k` into a stage change, `before` as it began and `now` as the new stage gives
 * it: eased across for a hole that stays, else given up and taken up as its light is.
 */
export const restageLens = (role: Role | null, before: number, now: number, k: number) =>
  role === "stays"
    ? lerp(before, now, smootherstep(k))
    : before * restageLight("leaves", k) + now * restageLight("comes", k);

/** How far a stage change has come after `dt` more seconds of `seconds` (1: done). */
export const stepRestage = (level: number, dt: number, seconds: number, reduce: boolean) =>
  reduce ? 1 : Math.min(1, level + dt / seconds);

/** Where the pair's camera starts: on whichever of the two the stage framed before, else the larger. */
export const pairStart = (pair: Pair, framed: number) => (framed === pair.small ? 0 : 1);

/** The body of the pair the camera is nearer framing: its surface and weather come alive. */
export const pairLanded = (pair: Pair, t: number) => (t < 0.5 ? pair.small : pair.large);
