// Deterministic procedural noise. No uniforms, no texture lookups, so the
// same inputs give the same values on every GPU.

// Hash of a 3D cell to [0, 1).
float hash13(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.x + p.y) * p.z);
}

// Hash of a 2D point to [0, 1). Integer and pixel-centre inputs must not
// repeat: a pre-scale like 127.1 wraps every 10 cells and tiles the output.
float hash21(vec2 p) {
  vec3 p3 = fract(p.xyx * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

// Smooth value noise: bilinear blend of the four surrounding cell hashes.
float value2(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);

  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));

  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// Three fixed octaves of value noise; the weights sum to 1.
float fbm2(vec2 p) {
  return value2(p) * 0.55 + value2(p * 2.07) * 0.28 + value2(p * 4.13) * 0.17;
}
