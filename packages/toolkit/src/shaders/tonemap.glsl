// Filmic tone curve (the ACES rational fit) with an explicit exposure.
// Output is clamped to [0, 1]; this is not a colour-management pipeline.

vec3 tonemap(vec3 x, float exposure) {
  x *= exposure;
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

// A tone curve on a colour's brightest channel, the others scaled with it, so a red source
// keeps its hue instead of clipping to flat orange: linear up to `shoulder`, then rolling off
// towards 1. `saturation` scales the colour about its luminance first (1: as given). As film
// does, the brightest light whitens: up to `highlightWhite` near the top of the curve, a deep
// red (little luminance to spill into the other channels) hardly at all, and light far past
// what the screen shows fully. Output clamped [0, 1].
vec3 tonemapHue(vec3 x, float exposure, float shoulder, float saturation, float highlightWhite) {
  vec3 c = max(x, 0.0);
  float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = max(mix(vec3(luma), c, saturation), 0.0);
  float peak = max(c.r, max(c.g, c.b));
  float v = peak * exposure;
  float mapped = v < shoulder ? v : shoulder + (1.0 - shoulder) * (1.0 - exp(-(v - shoulder) / (1.0 - shoulder)));
  vec3 toned = c * (mapped / max(peak, 1e-6));
  float near = smoothstep(0.15, 0.6, dot(c, vec3(0.2126, 0.7152, 0.0722)) / max(peak, 1e-6));
  float white = max(highlightWhite * near * smoothstep(shoulder, 1.0, mapped), smoothstep(1.5, 6.0, v));
  return clamp(mix(toned, vec3(mapped), white), 0.0, 1.0);
}
