import { frameMeter } from "./frame-meter";

/** Frame pacing is separate from numerical integration. dt is elapsed seconds, capped per frame. */
export class FrameClock {
  private last: number | null = null;
  private held = 0;
  constructor(private readonly maxDelta = 0.1) {}
  reset() {
    this.last = null;
    this.held = 0;
  }
  advance(now: number, fps = Infinity): number | null {
    if (this.last === null) {
      this.last = now;
      return 0;
    }
    const dt = Math.max(0, Math.min((now - this.last) / 1000, this.maxDelta));
    this.last = now;
    this.held += dt;
    if (fps <= 0) return null;
    /* Draw on the display frame nearest the target interval. Waiting for the whole interval
       would often cost a whole extra display frame: display frames run a hair short, so 30 fps
       would draw at 20 on a 60 Hz screen, and 60 at about 40. */
    if (this.held < 1 / fps - dt / 2) return null;
    const elapsed = this.held;
    this.held = 0;
    return elapsed;
  }
}

/** Pauses on visibility/page lifecycle events. Call sync after an app-specific pause changes. */
export function createFrameLoop(options: {
  render: (dt: number) => void;
  paused?: () => boolean;
  fps?: () => number;
  onError?: (error: unknown) => void;
}) {
  const clock = new FrameClock();
  let frame: number | null = null;
  let disposed = false;
  let suspended = false;
  let failed = false;
  let rendering = false;
  const paused = () =>
    disposed || failed || suspended || document.hidden || (options.paused?.() ?? false);
  function tick(now: number) {
    frame = null;
    if (paused()) return;
    const dt = clock.advance(now, options.fps?.() ?? Infinity);
    rendering = true;
    try {
      if (dt !== null) {
        options.render(dt);
        frameMeter.tick(now);
      }
    } catch (error) {
      failed = true;
      if (options.onError) options.onError(error);
      else throw error;
    } finally {
      rendering = false;
    }
    if (!paused() && frame === null) frame = window.requestAnimationFrame(tick);
  }
  /**
   * Re-evaluate the pause state. Pausing cancels the scheduled frame; resuming
   * from idle restarts the clock. A sync while the loop is already running (a
   * drag, a store write inside render) leaves its clock alone, so dt stays honest.
   */
  function sync() {
    if (paused()) {
      if (frame !== null) window.cancelAnimationFrame(frame);
      frame = null;
      clock.reset();
      return;
    }
    if (frame === null && !rendering) {
      clock.reset();
      frame = window.requestAnimationFrame(tick);
    }
  }
  const suspend = () => {
    suspended = true;
    sync();
  };
  const resume = () => {
    suspended = false;
    sync();
  };
  document.addEventListener("visibilitychange", sync);
  document.addEventListener("freeze", suspend);
  document.addEventListener("resume", resume);
  window.addEventListener("pagehide", suspend);
  window.addEventListener("pageshow", resume);
  window.addEventListener("focus", sync);
  sync();
  return {
    sync,
    dispose() {
      disposed = true;
      sync();
      document.removeEventListener("visibilitychange", sync);
      document.removeEventListener("freeze", suspend);
      document.removeEventListener("resume", resume);
      window.removeEventListener("pagehide", suspend);
      window.removeEventListener("pageshow", resume);
      window.removeEventListener("focus", sync);
    },
  };
}
