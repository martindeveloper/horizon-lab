/**
 * Replayable chance: a hash of the seed and up to three integer salts to [0, 1), so any moment
 * of the Sun's weather comes out the same however it is reached.
 */
export function dice(seed: number, a: number, b = 0, c = 0) {
  let h = (seed ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ (a >>> 0), 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h ^ (b >>> 0), 0xc2b2ae35);
  h ^= h >>> 16;
  h = Math.imul(h ^ (c >>> 0), 0x27d4eb2f);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

/** A standard normal deviate from two throws (Box–Muller). */
export function gaussDice(seed: number, a: number, b = 0, c = 0) {
  const u = 1 - dice(seed, a, b, c);
  const v = dice(seed, a + 7919, b, c);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** `lo` to `hi` by a throw. */
export const between = (range: readonly [number, number], throw_: number) =>
  range[0] + (range[1] - range[0]) * throw_;
