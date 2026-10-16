# Scalar math

`@horizon/toolkit/math` is dependency-free and intentionally small.

- `mulberry32(seed)`: deterministic noncryptographic generator returning values in [0, 1);
  use for reproducible procedural visuals, never security-sensitive values.
- `lcg(seed)`: weaker linear congruential generator with a 10⁻⁶ step, kept
  because seeded orrery artwork depends on its exact sequence. Prefer `mulberry32`.
- `valueNoise2(x, y)` / `valueNoise3(x, y, z)`: smooth value noise in [0, 1];
  the 3D lattice repeats every 256 units. Sample 3D noise on a unit sphere for
  seamless planet maps. `fbm3(x, y, z, octaves)` sums octaves (lacunarity 2.03,
  gain 0.5), normalized to [0, 1]. CPU only; the GLSL `noiseGLSL` hashes differ.
- `clamp(value, min, max)`: inclusive bounds; caller supplies ordered bounds.
  `clamp01(value)` is the [0, 1] case for hot loops.
- `smoothstep(edge0, edge1, x)`: GLSL semantics; reversed edges run downhill.
- `wrap(value, period)` → [0, period); `wrapSigned(value, period)` →
  [−period/2, period/2), the shortest signed angle difference.
- `lerp(from, to, t)`: linear interpolation, allowing extrapolation.
- `smootherstep(t)`: quintic `6t⁵ − 15t⁴ + 10t³`, clamped to [0, 1].
- `toLogFraction(value, min, max)` / `fromLogFraction(t, min, max)`: inverses for
  logarithmic controls; clamp to their ranges. Bounds must be finite and
  `0 < min < max`, otherwise a RangeError is thrown.

Inputs should be finite. Use Three.js vector/matrix types in rendering code;
this module does not duplicate a linear-algebra library. Physics equations
belong to their simulation unless multiple consumers share the same assumptions.
