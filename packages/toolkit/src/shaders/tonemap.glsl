// Filmic tone curve (the ACES rational fit) with an explicit exposure.
// Output is clamped to [0, 1]; this is not a colour-management pipeline.

vec3 tonemap(vec3 x, float exposure) {
  x *= exposure;
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}
