// What the Sun's shaders in every lab share besides the continuum: a float table read by
// hand, a turn about the pole, and when a surface feature is wide enough to draw.
#include "./parameters.generated.glsl"

// A nearest-filtered float table interpolated by hand, so no float-linear extension is needed:
// `x` 0–1 across its `size` texels, on row `row` of `rows`.
vec4 tableAt(highp sampler2D table, float x, int size, int row, int rows) {
  float at = clamp(x, 0.0, 1.0) * float(size - 1);
  float lo = floor(at);
  float v = (float(row) + 0.5) / float(rows);
  vec4 a = texture2D(table, vec2((lo + 0.5) / float(size), v));
  vec4 b = texture2D(table, vec2((min(lo + 1.0, float(size - 1)) + 0.5) / float(size), v));
  return mix(a, b, at - lo);
}

// A point of the unit sphere turned `angle` about the pole.
vec3 turned(vec3 p, float angle) {
  float ca = cos(angle);
  float sa = sin(angle);
  return vec3(ca * p.x + sa * p.z, p.y, -sa * p.x + ca * p.z);
}

// How much of a feature `pixels` drawing-buffer pixels across shows: none below
// SURFACE_RESOLVE_PX, all from twice that. Filtering changes visibility, never a feature's size.
float resolvedPixels(float pixels) {
  return smoothstep(SURFACE_RESOLVE_PX, 2.0 * SURFACE_RESOLVE_PX, pixels);
}
