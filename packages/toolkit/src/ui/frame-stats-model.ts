/**
 * The arithmetic behind `FrameStats`, apart from React so it can be tested: the display's
 * refresh interval from its own frame times, and how many vsync windows a frame took.
 */

/** The middle value, robust to a stray long or short frame; 0 for none. */
export function median(values: readonly number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** Vsync windows a frame of `frameMs` spanned on a display refreshing every `refreshMs`. */
export function vsyncWindows(frameMs: number, refreshMs: number) {
  if (!(refreshMs > 0) || !(frameMs > 0)) return 0;
  return Math.max(1, Math.round(frameMs / refreshMs));
}

/** Common refresh rates, so a measured 59.8 Hz reads as the 60 Hz panel it is. */
const RATES = [24, 30, 48, 50, 60, 72, 75, 90, 100, 120, 144, 165, 180, 240, 360];

/** The display's refresh rate in Hz from its frame interval, snapped to a common rate within 3 %. */
export function refreshRate(refreshMs: number) {
  if (!(refreshMs > 0)) return 0;
  const hz = 1000 / refreshMs;
  const near = RATES.find((rate) => Math.abs(rate - hz) / rate < 0.03);
  return near ?? Math.round(hz);
}
