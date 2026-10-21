/**
 * The ladder's geometry, without the DOM or WebGL: every body stands on one horizon line, side
 * by side in order of size, each just right of the one before; the camera's place on the
 * ladder is a number `t` (rung 3.5 is halfway from the fourth body to the fifth). At a whole
 * rung that body stands in the middle of the stage at a fixed share of its height; between two
 * the scale grows geometrically and the view zooms out about the first body, so it stays in
 * sight until the larger one takes over.
 */
import { FRAME_FILL, FRAME_FILL_WIDTH, HORIZON_Y, MIN_DISC_PX, RUNG_GAP } from "../parameters";

/**
 * A body's size on the ladder, metres: equatorial radius, its published spread, polar radius;
 * and how far its light reaches past its radius, radii (1 when only its disc counts).
 */
export type BodySize = {
  radius: number;
  low: number;
  high: number;
  polar: number;
  reach?: number;
};

/** The stage in CSS pixels. */
export type Stage = { width: number; height: number };

/** A body as the stage shows it, CSS pixels from the top left. */
export type Placed = {
  index: number;
  /** Centre. */
  x: number;
  y: number;
  /** Equatorial and polar radius, and the spread of the equatorial radius. */
  radius: number;
  polar: number;
  low: number;
  high: number;
};

export type Ladder = {
  sizes: readonly BodySize[];
  /** Each body's centre along the horizon, metres from the first. */
  centres: readonly number[];
  /** The last rung's index. */
  last: number;
};

export function createLadder(sizes: readonly BodySize[]): Ladder {
  const centres: number[] = [];
  sizes.forEach((size, i) => {
    const before = sizes[i - 1];
    const previous = centres[i - 1];
    centres.push(
      before === undefined || previous === undefined
        ? 0
        : previous + before.radius + RUNG_GAP * size.radius + size.radius,
    );
  });
  return { sizes, centres, last: sizes.length - 1 };
}

/** The horizon's height on the stage, CSS pixels from the top. */
export const horizonOf = (stage: Stage) => stage.height * HORIZON_Y;

/** The radius a focused body is drawn at, CSS pixels. */
export const framedRadius = (stage: Stage) =>
  Math.max(1, Math.min(FRAME_FILL * stage.height, FRAME_FILL_WIDTH * stage.width) / 2);

export const clampRung = (ladder: Ladder, t: number) => Math.min(ladder.last, Math.max(0, t));

/** The nearest whole rung to a place on the ladder. */
export const nearestRung = (ladder: Ladder, t: number) => Math.round(clampRung(ladder, t));

/** Metres per CSS pixel at a whole rung: its body at the framed radius. */
const rungScale = (ladder: Ladder, index: number, stage: Stage) =>
  ladder.sizes[index]!.radius / framedRadius(stage);

/** The camera on the ladder: metres per CSS pixel, and the point of the horizon (metres from the first body's centre) under the middle of the stage. */
export type Camera = { scale: number; centre: number };

/** The camera at a place on the ladder, written into `out` (a frame reuses one). */
export function cameraAt(
  ladder: Ladder,
  t: number,
  stage: Stage,
  out: Camera = { scale: 0, centre: 0 },
): Camera {
  const at = clampRung(ladder, t);
  const i = Math.min(Math.floor(at), Math.max(0, ladder.last - 1));
  const f = at - i;
  const from = rungScale(ladder, i, stage);
  if (ladder.last === 0) {
    out.scale = from;
    out.centre = 0;
    return out;
  }
  const to = rungScale(ladder, i + 1, stage);
  const scale = from * (to / from) ** f;
  /* A zoom about a fixed point: the share of the way the scale has grown is the share of the
     way the view has moved, so the smaller body stays put while the view widens round it. */
  const share = Math.abs(to - from) > 1e-12 * from ? (scale - from) / (to - from) : f;
  const a = ladder.centres[i]!;
  const b = ladder.centres[i + 1]!;
  out.scale = scale;
  out.centre = a + (b - a) * share;
  return out;
}

/** A placed body to fill in. */
export const blankPlaced = (): Placed => ({
  index: 0,
  x: 0,
  y: 0,
  radius: 0,
  polar: 0,
  low: 0,
  high: 0,
});

/** One body on the stage as `camera` sees it, in view or not, written into `out`. */
export function placeBody(
  ladder: Ladder,
  camera: Camera,
  stage: Stage,
  index: number,
  out: Placed = blankPlaced(),
): Placed {
  const size = ladder.sizes[index]!;
  const polar = Math.max(MIN_DISC_PX, size.polar / camera.scale);
  out.index = index;
  out.x = stage.width / 2 + (ladder.centres[index]! - camera.centre) / camera.scale;
  out.y = horizonOf(stage) - polar;
  out.radius = Math.max(MIN_DISC_PX, size.radius / camera.scale);
  out.polar = polar;
  out.low = size.low / camera.scale;
  out.high = size.high / camera.scale;
  return out;
}

/**
 * Every body whose light is in view (with a margin), placed on the stage as `camera` sees it,
 * largest first; the smallest drawn at `MIN_DISC_PX`, so the bodies left behind stay points
 * along the horizon. A body joins while its light's reach first touches the stage, not its
 * disc, so nothing pops in. The rungs climb by size, so counting down from the last is largest
 * first. The bodies are written into `out`, whose entries a frame reuses; returns how many.
 */
export function placeBodiesInto(
  out: Placed[],
  ladder: Ladder,
  camera: Camera,
  stage: Stage,
  margin = 0.15,
): number {
  const pad = stage.width * margin;
  let count = 0;
  for (let index = ladder.last; index >= 0; index--) {
    const size = ladder.sizes[index]!;
    const radius = Math.max(MIN_DISC_PX, size.radius / camera.scale);
    const x = stage.width / 2 + (ladder.centres[index]! - camera.centre) / camera.scale;
    const reach = radius * (size.reach ?? 1);
    if (x + reach < -pad || x - reach > stage.width + pad) continue;
    placeBody(ladder, camera, stage, index, (out[count] ??= blankPlaced()));
    count++;
  }
  return count;
}

/** Every body in view at a place on the ladder, largest first (`placeBodiesInto`). */
export function placeBodies(ladder: Ladder, t: number, stage: Stage, margin = 0.15): Placed[] {
  const out: Placed[] = [];
  out.length = placeBodiesInto(out, ladder, cameraAt(ladder, t, stage), stage, margin);
  return out;
}

/** The rung whose body is under a stage point, if any (the smallest wins where bodies overlap). */
export function bodyAt(ladder: Ladder, t: number, stage: Stage, x: number, y: number, slop = 10) {
  let best: Placed | null = null;
  for (const body of placeBodies(ladder, t, stage, 0)) {
    const dx = (x - body.x) / (body.radius + slop);
    const dy = (y - body.y) / (body.polar + slop);
    if (dx * dx + dy * dy <= 1 && (!best || body.radius < best.radius)) best = body;
  }
  return best?.index ?? null;
}
