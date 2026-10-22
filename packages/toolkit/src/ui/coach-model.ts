/**
 * The coach's arithmetic, without React or the DOM: a step's cues on a clock, and where the
 * card stands beside the control it points at.
 */

/** A step's move on the scene: what it does, `at` seconds after the step begins (0 at once). */
export type TourCue = { at?: number; run: () => void };

/** The clock cues wait on: runs `run` after `seconds`, returning its cancel. The window's by default, a test's own in tests. */
export type CueClock = (seconds: number, run: () => void) => () => void;

const windowClock: CueClock = (seconds, run) => {
  const id = setTimeout(run, seconds * 1000);
  return () => clearTimeout(id);
};

/**
 * Plays a step's cues in their order: those at 0 at once, the rest on the clock. Returns the
 * stop, which drops the cues still waiting (the step changed, the tour ended).
 */
export function playCues(cues: readonly TourCue[], clock: CueClock = windowClock) {
  const waiting = cues.map(({ at = 0, run }) => {
    if (at > 0) return clock(at, run);
    run();
    return null;
  });
  return () => waiting.forEach((cancel) => cancel?.());
}

export type CoachRect = { left: number; top: number; width: number; height: number };
type Size = { width: number; height: number };

/** Where the card goes: its top-left corner, and the side of its target it took (`free` with none). */
export type CoachPlacement = {
  left: number;
  top: number;
  side: "below" | "above" | "right" | "left" | "free";
};

const area = (a: CoachRect, b: CoachRect) =>
  Math.max(0, Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left)) *
  Math.max(0, Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top));

/** Covering the target costs this many times what covering anything else does. */
const TARGET_WEIGHT = 8;

/**
 * Where the card stands: of the places beside its target (below, above, right, left, each
 * aligned to the target's middle, start and end) or, with no target, of the places over the
 * open scene (low in the middle first), the one that covers least of the `obstacles` (the HUD's
 * surfaces) and never the target itself. Every place is held `gap` inside the stage; ties go
 * to the earlier place, so the card keeps below or above its target where it can.
 */
export function placeCoach({
  target,
  card,
  stage,
  obstacles,
  gap,
}: {
  target: CoachRect | null;
  card: Size;
  stage: Size;
  obstacles: readonly CoachRect[];
  gap: number;
}): CoachPlacement {
  const clamp = (value: number, size: number, room: number) =>
    Math.min(Math.max(value, gap), Math.max(gap, room - gap - size));
  const at = (left: number, top: number, side: CoachPlacement["side"]): CoachPlacement => ({
    left: clamp(left, card.width, stage.width),
    top: clamp(top, card.height, stage.height),
    side,
  });
  const places: CoachPlacement[] = [];
  if (target) {
    const right = target.left + target.width;
    const bottom = target.top + target.height;
    const across = [
      target.left + target.width / 2 - card.width / 2,
      target.left,
      right - card.width,
    ];
    const down = [
      target.top + target.height / 2 - card.height / 2,
      target.top,
      bottom - card.height,
    ];
    /* Below a control in the top half first, above one lower down. */
    const below = { side: "below" as const, top: bottom + gap };
    const above = { side: "above" as const, top: target.top - gap - card.height };
    const high = target.top + target.height / 2 < stage.height / 2;
    for (const { side, top } of high ? [below, above] : [above, below])
      for (const left of across) places.push(at(left, top, side));
    for (const top of down) places.push(at(right + gap, top, "right"));
    for (const top of down) places.push(at(target.left - gap - card.width, top, "left"));
  } else {
    const middle = (stage.width - card.width) / 2;
    for (const share of [0.68, 0.5, 0.3, 0.82])
      for (const left of [
        middle,
        stage.width * 0.2 - card.width / 2,
        stage.width * 0.8 - card.width / 2,
      ])
        places.push(at(left, stage.height * share - card.height / 2, "free"));
  }
  let best = places[0]!;
  let cost = Infinity;
  for (const place of places) {
    const box = { ...place, ...card };
    const covered =
      obstacles.reduce((sum, obstacle) => sum + area(box, obstacle), 0) +
      (target ? TARGET_WEIGHT * area(box, target) : 0);
    if (covered < cost) {
      cost = covered;
      best = place;
    }
  }
  return best;
}

/**
 * The leader from the card to its target: from the point of the card's edge nearest the
 * target's middle to the point of the target's edge nearest the card's middle. Null when they
 * touch.
 */
export function coachLeader(card: CoachRect, target: CoachRect) {
  const apart = (a: CoachRect, b: CoachRect, axis: "left" | "top", size: "width" | "height") =>
    Math.max(0, b[axis] - (a[axis] + a[size]), a[axis] - (b[axis] + b[size]));
  if (Math.hypot(apart(card, target, "left", "width"), apart(card, target, "top", "height")) < 1)
    return null;
  const nearest = (box: CoachRect, x: number, y: number) => ({
    x: Math.min(Math.max(x, box.left), box.left + box.width),
    y: Math.min(Math.max(y, box.top), box.top + box.height),
  });
  return {
    from: nearest(card, target.left + target.width / 2, target.top + target.height / 2),
    to: nearest(target, card.left + card.width / 2, card.top + card.height / 2),
  };
}
