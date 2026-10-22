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

/**
 * The kinds of surface the callout meets, and what covering a pixel of each costs it: what the
 * step is about (`kept`: what the target has open, what the step brought up) and what lies over
 * the stage and would hide it (`over`: the page's bars) most, as much as the target; anything
 * else (`bright`) one; HUD the step has quieted (`quiet`) little. Only what is kept draws the
 * callout beside it and stops the leader.
 */
export const COVER = { kept: 8, over: 8, bright: 1, quiet: 0.3 } as const;
export type CoverKind = keyof typeof COVER;

/** Something the callout would rather not cover, and of what kind (`bright` by default). */
export type CoachObstacle = CoachRect & { kind?: CoverKind };

const costOf = (obstacle: CoachObstacle) => COVER[obstacle.kind ?? "bright"];
/** What the callout must never cover: what the step is about, and what would hide it. */
const never = (obstacle: CoachObstacle) => costOf(obstacle) >= COVER.kept;
/** What the step is about: the callout may stand beside it, and its leader goes round it. */
export const keptOf = (obstacles: readonly CoachObstacle[]) =>
  obstacles.filter((obstacle) => obstacle.kind === "kept");

/**
 * Where the card stands: of the places beside its target (below, above, right, left, each
 * aligned to the target's middle, start and end) or, with no target, of the places over the
 * open scene (low in the middle first), the one that covers least of the `obstacles` (the HUD's
 * surfaces, each by its kind) and of the target, which costs as much as anything kept. Every place is held `gap` inside the stage; ties go
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
  obstacles: readonly CoachObstacle[];
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
    /* Beside a box, at the given offsets along it: its middle, start and end by default. */
    const beside = (
      box: CoachRect,
      across = [
        box.left + box.width / 2 - card.width / 2,
        box.left,
        box.left + box.width - card.width,
      ],
      down = [
        box.top + box.height / 2 - card.height / 2,
        box.top,
        box.top + box.height - card.height,
      ],
    ) => {
      /* Below a box in the top half first, above one lower down. */
      const below = { side: "below" as const, top: box.top + box.height + gap };
      const above = { side: "above" as const, top: box.top - gap - card.height };
      const high = box.top + box.height / 2 < stage.height / 2;
      for (const { side, top } of high ? [below, above] : [above, below])
        for (const left of across) places.push(at(left, top, side));
      for (const top of down) places.push(at(box.left + box.width + gap, top, "right"));
      for (const top of down) places.push(at(box.left - gap - card.width, top, "left"));
    };
    beside(target);
    /* Then beside what the step opened (a picker's list, a panel), level with the target. */
    for (const kept of keptOf(obstacles))
      beside(kept, [target.left, kept.left], [target.top, kept.top]);
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
      obstacles.reduce((sum, obstacle) => sum + costOf(obstacle) * area(box, obstacle), 0) +
      (target ? COVER.kept * area(box, target) : 0);
    if (covered < cost) {
      cost = covered;
      best = place;
    }
  }
  return best;
}

/**
 * Whether the callout may stay where it stands as the page changes within a step: it still
 * fits the stage, and nothing it must never cover (its target, what the step opened, the bars)
 * has come under it. A callout that moved at every panel or card would be hard to read.
 */
export function placeHolds({
  place,
  card,
  stage,
  target,
  obstacles,
}: {
  place: CoachPlacement;
  card: Size;
  stage: Size;
  target: CoachRect | null;
  obstacles: readonly CoachObstacle[];
}) {
  const box = { ...place, ...card };
  const fits =
    box.left >= 0 &&
    box.top >= 0 &&
    box.left + box.width <= stage.width &&
    box.top + box.height <= stage.height;
  const kept = [...(target ? [target] : []), ...obstacles.filter(never)];
  return fits && kept.every((rect) => area(box, rect) === 0);
}

/** Where the callout settled: for which step and which target (any identity), and where. */
export type CoachSettled<T> = { step: number; target: T | null; place: CoachPlacement };

/**
 * Where the callout stands now, and what it settles on (null: as it was). Until the step's page
 * is `read` it stays where the last step left it; then it takes the best place (`placeCoach`)
 * and keeps it, for that step and that target, while it holds (`placeHolds`).
 */
export function settleCoach<T>({
  settled,
  step,
  read,
  targetId,
  target,
  card,
  stage,
  obstacles,
  gap,
}: {
  settled: CoachSettled<T> | null;
  step: number;
  read: boolean;
  /** The target's identity (its element), so a new one is placed afresh. */
  targetId: T | null;
  target: CoachRect | null;
  card: Size;
  stage: Size;
  obstacles: readonly CoachObstacle[];
  gap: number;
}): { place: CoachPlacement | null; settle: CoachSettled<T> | null } {
  const measured = card.width > 0 && stage.width > 0;
  if (!measured || !read) return { place: settled?.place ?? null, settle: null };
  const ours = settled?.step === step && settled.target === targetId;
  if (ours && placeHolds({ place: settled.place, card, stage, target, obstacles }))
    return { place: settled.place, settle: null };
  const place = placeCoach({ target, card, stage, obstacles, gap });
  const same = ours && place.left === settled.place.left && place.top === settled.place.top;
  return { place, settle: same ? null : { step, target: targetId, place } };
}

type Point = { x: number; y: number };

/** Whether an upright or level segment from `a` to `b` passes through `box`. */
function crosses(a: Point, b: Point, box: CoachRect) {
  const [x0, x1] = a.x < b.x ? [a.x, b.x] : [b.x, a.x];
  const [y0, y1] = a.y < b.y ? [a.y, b.y] : [b.y, a.y];
  return x0 < box.left + box.width && x1 > box.left && y0 < box.top + box.height && y1 > box.top;
}

/**
 * The leader from the card to its target, in right angles: straight up, down or across where
 * the two share a column or a row (through the middle of what they share), else out of the
 * card's side and one turn onto the target. None when they touch, or when its path would run
 * through any of `blockers` (what the step opened: a list, a panel) that does not hold the
 * target, where the ring and the open surface already say enough.
 */
export function coachLeader(
  card: CoachRect,
  target: CoachRect,
  blockers: readonly CoachRect[] = [],
): readonly Point[] | null {
  const apart = (a: CoachRect, b: CoachRect, axis: "left" | "top", size: "width" | "height") =>
    Math.max(0, b[axis] - (a[axis] + a[size]), a[axis] - (b[axis] + b[size]));
  if (Math.hypot(apart(card, target, "left", "width"), apart(card, target, "top", "height")) < 1)
    return null;
  const right = (box: CoachRect) => box.left + box.width;
  const bottom = (box: CoachRect) => box.top + box.height;
  const across = [Math.max(card.left, target.left), Math.min(right(card), right(target))] as const;
  const down = [Math.max(card.top, target.top), Math.min(bottom(card), bottom(target))] as const;
  const above = bottom(target) <= card.top;
  const leftOf = right(target) <= card.left;
  let points: Point[];
  if (across[1] > across[0]) {
    const x = (across[0] + across[1]) / 2;
    points = [
      { x, y: above ? card.top : bottom(card) },
      { x, y: above ? bottom(target) : target.top },
    ];
  } else if (down[1] > down[0]) {
    const y = (down[0] + down[1]) / 2;
    points = [
      { x: leftOf ? card.left : right(card), y },
      { x: leftOf ? right(target) : target.left, y },
    ];
  } else {
    const y = card.top + card.height / 2;
    const x = target.left + target.width / 2;
    points = [
      { x: leftOf ? card.left : right(card), y },
      { x, y },
      { x, y: above ? bottom(target) : target.top },
    ];
  }
  const holds = (box: CoachRect) =>
    box.left <= target.left &&
    box.top <= target.top &&
    right(box) >= right(target) &&
    bottom(box) >= bottom(target);
  const blocked = blockers.some(
    (box) => !holds(box) && points.slice(1).some((point, k) => crosses(points[k]!, point, box)),
  );
  return blocked ? null : points;
}
