/**
 * Counts drawn frames to report a frame rate and recent frame times. Loops call `tick(now)`
 * after each frame they draw; `rate()` is the rate over the last `span` seconds, 0 once frames
 * stop (an idle scene draws none), and `intervals()` the times between the last `keep` frames.
 * A pause longer than `gap` ms starts afresh, so waking from idle is not one slow frame.
 * Framework-free; read it as often as a readout needs.
 */
export function createFrameMeter({ span = 0.5, keep = 120, gap = 250 } = {}) {
  const times: number[] = [];
  const intervals: number[] = [];
  let last: number | null = null;
  const trim = (now: number) => {
    while (times.length > 0 && now - times[0]! > span * 1000) times.shift();
  };
  return {
    /** A frame was drawn at `now`, in milliseconds as `requestAnimationFrame` gives it. */
    tick(now: number) {
      if (last !== null && now - last <= gap) {
        intervals.push(now - last);
        if (intervals.length > keep) intervals.shift();
      }
      last = now;
      times.push(now);
      trim(now);
    },
    /** Frames per second over the last `span` seconds; 0 when fewer than two were drawn. */
    rate(now = performance.now()) {
      trim(now);
      if (times.length < 2) return 0;
      return ((times.length - 1) * 1000) / (times[times.length - 1]! - times[0]!);
    },
    /** Milliseconds between the most recent drawn frames, oldest first. */
    intervals(): readonly number[] {
      return intervals;
    },
  };
}

export type FrameMeter = ReturnType<typeof createFrameMeter>;

/** The page's meter: every `createFrameLoop` feeds it; one simulation runs at a time. */
export const frameMeter = createFrameMeter();
