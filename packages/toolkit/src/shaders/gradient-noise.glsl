// Gradient noise: smoother than value noise, with no grid showing, in 2D and 3D. Sine-free
// and texture-free, so the same inputs give the same values on every GPU.

// Three hashes of a cell to [0, 1) (Hoskins' hash without sine).
vec3 hash33(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.xxy + p.yxx) * p.zyx);
}

float gradientCorner3(vec3 cell, vec3 f, vec3 offset) {
  return dot(hash33(cell + offset) * 2.0 - 1.0, f - offset);
}

// Gradient noise in 3D, about −1 to 1, smooth through its second derivative.
float gradientNoise3(vec3 p) {
  vec3 i = floor(p);
  vec3 f = p - i;
  vec3 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = gradientCorner3(i, f, vec3(0.0, 0.0, 0.0));
  float b = gradientCorner3(i, f, vec3(1.0, 0.0, 0.0));
  float c = gradientCorner3(i, f, vec3(0.0, 1.0, 0.0));
  float d = gradientCorner3(i, f, vec3(1.0, 1.0, 0.0));
  float e = gradientCorner3(i, f, vec3(0.0, 0.0, 1.0));
  float g = gradientCorner3(i, f, vec3(1.0, 0.0, 1.0));
  float h = gradientCorner3(i, f, vec3(0.0, 1.0, 1.0));
  float k = gradientCorner3(i, f, vec3(1.0, 1.0, 1.0));
  return mix(mix(mix(a, b, u.x), mix(c, d, u.x), u.y), mix(mix(e, g, u.x), mix(h, k, u.x), u.y), u.z);
}

float gradientCorner2(vec2 cell, vec2 f, vec2 offset) {
  return dot(hash33(vec3(cell + offset, 0.5)).xy * 2.0 - 1.0, f - offset);
}

// Gradient noise in 2D, about −1 to 1.
float gradientNoise2(vec2 p) {
  vec2 i = floor(p);
  vec2 f = p - i;
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = gradientCorner2(i, f, vec2(0.0, 0.0));
  float b = gradientCorner2(i, f, vec2(1.0, 0.0));
  float c = gradientCorner2(i, f, vec2(0.0, 1.0));
  float d = gradientCorner2(i, f, vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// Two octaves of gradient noise, about −1 to 1.
float gradientFbm3(vec3 p) {
  return 0.67 * gradientNoise3(p) + 0.33 * gradientNoise3(p * 2.13 + 7.7);
}
