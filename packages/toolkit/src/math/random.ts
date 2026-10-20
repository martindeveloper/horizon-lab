/** Deterministic visual sampling in [0, 1); not a cryptographic generator. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Linear congruential generator in [0, 1) with a 10⁻⁶ step. Weaker than
 * `mulberry32`; kept because seeded artwork depends on its exact sequence.
 */
export function lcg(seed: number) {
  let s = seed;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) | 0;
    return ((s >>> 0) % 1_000_000) / 1_000_000;
  };
}

/**
 * Park–Miller minimal standard generator in [0, 1): `seed` must be in 1..2³¹−2. Weaker
 * than `mulberry32`; kept because seeded painted artwork depends on its exact sequence.
 */
export function minstd(seed: number) {
  let s = seed;
  return () => (s = (s * 16_807) % 2_147_483_647) / 2_147_483_647;
}

/** A standard normal deviate (Box–Muller) from two draws of `rnd`; the log floor is 10⁻⁶. */
export function gaussian(rnd: () => number) {
  const u = Math.max(1e-6, rnd());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(Math.PI * 2 * rnd());
}

/** A uniformly random direction scaled to `radius`, from two draws of `rnd`; z is the pole. */
export function onSphere(rnd: () => number, radius = 1): [number, number, number] {
  const u = rnd() * 2 - 1;
  const t = rnd() * Math.PI * 2;
  const s = Math.sqrt(1 - u * u);
  return [s * Math.cos(t) * radius, s * Math.sin(t) * radius, u * radius];
}
