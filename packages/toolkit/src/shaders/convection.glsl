// A star's convection, seen from above: cells of hot rising gas that drift, swell and die, and
// the brightness patterns they make. Inputs are in cells (a point on the unit sphere times the
// cells across its radius) and a time in seconds; outputs are about −1 to 1, for a caller to
// scale into a share of temperature. Includes <horizon/gradient-noise>.

#include <horizon/gradient-noise>

// Smooth cells: a soft distance to the drifting centres (a smooth minimum, so no creases where
// cells meet) and their own random numbers blended the same way, for a giant's few broad
// cells; `k` sets how soft. The distance runs from about 0.2 in a cell's heart to 0.65 where
// cells meet (k = 10), half of it under 0.47.
vec2 softConvectionCells(vec3 p, float t, float k) {
  vec3 base = floor(p);
  vec3 f = p - base;
  float weight = 0.0;
  float own = 0.0;
  for (int z = -1; z <= 1; z++) {
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec3 cell = vec3(float(x), float(y), float(z));
        vec3 h = hash33(base + cell);
        vec3 at = cell + 0.5 + 0.62 * (h - 0.5) + 0.1 * sin(t * (0.3 + 0.3 * h.yzx) + 6.2831853 * h.zxy);
        float swell = 0.13 * sin(t * (0.22 + 0.3 * h.x) + 6.2831853 * h.y);
        float w = exp(-k * (length(at - f) - swell));
        weight += w;
        own += w * h.z;
      }
    }
  }
  return vec2(-log(max(weight, 1e-6)) / k, own / max(weight, 1e-6));
}

// Cells that drift, grow and shrink: the distance to the nearest centre and to the
// next, each less the cell's own swelling (so a growing cell pushes its lanes outwards and a
// dying one is squeezed out), and the nearest cell's own random number.
vec3 convectionCells(vec3 p, float t) {
  vec3 base = floor(p);
  vec3 f = p - base;
  float near = 8.0;
  float next = 8.0;
  float own = 0.0;
  for (int z = -1; z <= 1; z++) {
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec3 cell = vec3(float(x), float(y), float(z));
        vec3 h = hash33(base + cell);
        vec3 at = cell + 0.5 + 0.62 * (h - 0.5) + 0.1 * sin(t * (0.3 + 0.3 * h.yzx) + 6.2831853 * h.zxy);
        float swell = 0.13 * sin(t * (0.22 + 0.3 * h.x) + 6.2831853 * h.y);
        float d = length(at - f) - swell;
        if (d < near) {
          next = near;
          near = d;
          own = h.z;
        } else if (d < next) {
          next = d;
        }
      }
    }
  }
  return vec3(near, next, own);
}

// Granulation: domed granules, each its own brightness, between narrow cool lanes; about −1
// in a lane to 1 in a bright granule's heart.
float granulation(vec3 p, float t) {
  vec3 c = convectionCells(p, t);
  float inside = smoothstep(0.0, 0.1, c.y - c.x);
  float dome = 1.0 - 0.75 * clamp(c.x, 0.0, 1.0);
  return mix(-1.0, (0.35 + 0.65 * c.z) * dome * 1.5 - 0.15, inside);
}

// A red supergiant's few giant cells: broad cells of hot rising gas, each its own brightness,
// between soft dark downflows, with no sharp lanes or creases; about −1 to 1.
float giantCells(vec3 p, float t) {
  vec2 c = softConvectionCells(p, t, 10.0);
  return (1.0 - smoothstep(0.36, 0.64, c.x)) * (0.45 + 0.55 * c.y) * 2.2 - 1.0;
}
