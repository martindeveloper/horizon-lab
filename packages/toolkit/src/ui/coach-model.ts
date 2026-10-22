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

/**
 * Where the card's top-left corner goes beside a target: under it when the target sits in the
 * upper half of the stage, above it otherwise, centred on it across and held `gap` inside the
 * stage's edges.
 */
export function placeCard(target: CoachRect, card: Size, stage: Size, gap: number) {
  const below = target.top + target.height / 2 < stage.height / 2;
  const top = below ? target.top + target.height + gap : target.top - gap - card.height;
  const centred = target.left + target.width / 2 - card.width / 2;
  const clamp = (value: number, max: number) => Math.min(Math.max(value, gap), Math.max(gap, max));
  return {
    left: clamp(centred, stage.width - gap - card.width),
    top: clamp(top, stage.height - gap - card.height),
    side: below ? ("below" as const) : ("above" as const),
  };
}
