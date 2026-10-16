// Procedural 3D sine hash in [0, 1). Seed is explicit, with no uniform/varying dependency.
float seededHash3(vec3 p, float seed) {
  return fract(sin(dot(p, vec3(127.1, 311.7, 74.7)) + seed * 13.7) * 43758.5453);
}
