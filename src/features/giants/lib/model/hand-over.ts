/**
 * Something that belongs to one body at a time and comes and goes in time, not with the
 * camera's distance, so a fast flight never cuts it off or flashes it on: it wakes once the
 * camera lands on its body and quietens as the camera leaves, and the next body's waits until
 * the last one's has faded. The star's weather and the planets' orbits are handed over so.
 */

/** Whose it is (a rung, or −1 for none) and how far it has come in, 0–1. */
export type HandOver = { owner: number; level: number };

export const NOBODY: HandOver = { owner: -1, level: 0 };

/**
 * The hand-over `dt` seconds on, with `wanted` the body it should belong to (−1: none): it
 * fades out over `outS` before passing on, then in over `inS`.
 */
export function handOver(
  fade: HandOver,
  wanted: number,
  dt: number,
  inS: number,
  outS: number,
): HandOver {
  if (fade.owner !== wanted) {
    const level = Math.max(0, fade.level - dt / outS);
    return level > 0 ? { owner: fade.owner, level } : { owner: wanted, level: 0 };
  }
  if (wanted < 0) return NOBODY;
  return { owner: wanted, level: Math.min(1, fade.level + dt / inS) };
}

/** Under reduced motion it changes hands at once. */
export const handOverAtOnce = (wanted: number): HandOver =>
  wanted < 0 ? NOBODY : { owner: wanted, level: 1 };

/** How much shows at a level: eased at both ends (smootherstep). */
export function eased(level: number) {
  const t = Math.min(1, Math.max(0, level));
  return t * t * t * (t * (t * 6 - 15) + 10);
}
