// What an active region marks on a star's face, in the region's own frame (`o`, `l`: along
// and across its axis in units of its size): a spot and the plage round it. Pure functions of
// their arguments; the caller scales them into temperature.
#include <horizon/gradient-noise>

// One spot at `o` from its centre: its umbra (1 inside), its penumbra (1 inside, umbra
// included) and the penumbra's filaments (0–1), bright and dark threads running out from the
// umbra. Both edges are ragged, the penumbra's more. `detail` above 1 adds finer threads;
// `footprint` is the spot's radius in buffer pixels, which filters the threads it resolves.
vec3 spot(vec2 o, float radius, float seed, float detail, float footprint) {
  float d = length(o) / max(radius, 1e-4);
  if (d > 1.5) return vec3(0.0);
  vec2 dir = o / max(length(o), 1e-5);
  float umbra = 1.0 - smoothstep(0.34, 0.42, d * (1.0 + 0.14 * gradientNoise2(dir * 2.2 + seed)));
  float penumbra = 1.0 - smoothstep(0.9, 0.98, d * (1.0 + 0.22 * gradientNoise2(dir * 1.6 + seed + 3.1)));
  float thread = 1.0 - abs(gradientNoise2(dir * 6.5 + vec2(seed, d * 0.6)));
  // Branching radial filaments, filtered at their projected width. They exist in the spot,
  // not in screen coordinates.
  float resolved = min(detail, 1.0) * smoothstep(2.0, 4.0, footprint / 28.0);
  if (resolved > 0.0) {
    vec2 bent = dir * 24.0 + vec2(seed + 0.8 * sin(d * 9.0 + seed), d * 1.8);
    float fine = 1.0 - abs(gradientNoise2(bent));
    thread = mix(thread, 0.4 * thread + 0.6 * fine * fine, resolved);
    if (detail > 1.0) thread += 0.12 * (detail - 1.0) * resolved * gradientNoise2(bent * 1.9 + d);
  }
  return vec3(umbra, penumbra, thread * thread);
}

// The plage round a region: a mottled patch of faculae, 0–1, brightest at its centre.
float plage(vec2 l, float seed) {
  return exp(-dot(l, l) / 1.5) * (0.5 + 0.5 * gradientNoise2(l * 4.5 + seed));
}
