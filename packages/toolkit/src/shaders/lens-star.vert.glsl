// Diffraction spikes (the lens pass), one instance per cell of the source level and line of a
// star: a telescope's spider vanes spread each point of light into thin lines across them, so
// a star is drawn on each bright, compact light rather than smeared over its whole shape.
//
// uCells is a coarse level of the bloom chain, each texel a cell of the frame holding the light
// above the bloom's threshold there. A cell is a light when it is the brightest of its 3 × 3
// neighbourhood (ties go to the earlier cell, so a plateau lights once) and the ring of cells
// two out is dark beside it on average: a light wider than a cell or two (a disc filling the
// view, the black hole's disk) is no point, and its spikes fade out as it grows, while a few
// specks around a light (asteroids round the Sun) leave it a point. Nor is a light whose glow
// spreads wide around its centre in the finer level (a galaxy's core): its spikes fade as its
// root-mean-square radius passes half a cell. Its energy is the
// neighbourhood's sum, in frame pixels of light (uCellArea), and its place the light-weighted
// centre of that neighbourhood in a finer level (uFine), so the star sits on the light, not
// on the cell.
//
// A clipped frame cannot tell how far past white a light is, so a light whose energy is below
// uFull spikes as the cube of its share of it: the Sun's star stands out from a white speck's.
// A spike's brightness falls as 1/r² from a core of uCore pixels (lens-star.frag.glsl), so it
// fades below uThreshold, the faintest light worth drawing, at a distance that grows with the
// square root of its energy: that is how long its line is drawn, at most uReach. Anything
// shorter than a few pixels is not drawn: every other instance collapses to a point and costs
// its vertex shader alone. Lines cross at HALF_PI + PI × axis / uAxes: upright and across for
// four points, upright and every 60° for six.

uniform sampler2D uCells;
uniform sampler2D uFine;
uniform vec2 uFrame;      // the frame, px
uniform float uCellArea;  // frame px² per cell of uCells
uniform int uAxes;        // lines per star
uniform float uReach;     // the longest half-line, frame px
uniform float uThreshold; // the faintest light a spike is drawn to, frame units
uniform float uStrength;  // the share of a light the composite adds back as spikes
uniform float uFull;      // the energy from which a light spikes in full; 0 for all
uniform float uWidth;     // a line's Gaussian width, frame px
uniform float uCore;      // a spike's core along the line, frame px (green)

varying vec2 vLine;   // along and across the line, frame px from the light
varying vec3 vLight;  // the light's energy
varying float vLength;

#include <horizon/math>

#define LENS_FINE_SPAN 12
#define LENS_SHORTEST 6.0
// Red spreads furthest: a vane's diffraction scales as the wavelength squared (630, 530, 465 nm).
#define LENS_RED_CORE 1.41

float luma(vec3 c) {
  return dot(c, vec3(0.2126, 0.7152, 0.0722));
}

vec3 cellAt(ivec2 c, ivec2 size) {
  if (any(lessThan(c, ivec2(0))) || any(greaterThanEqual(c, size))) return vec3(0.0);
  return texelFetch(uCells, c, 0).rgb;
}

// How far a spike carrying `energy` stays brighter than the threshold.
float visibleLength(float energy) {
  float peak = 1.0 / (uWidth * 2.5066283);
  float core = uCore * LENS_RED_CORE;
  return sqrt(max(uStrength * energy * peak * core / (PI * uThreshold), 0.0));
}

void main() {
  gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  vLine = vec2(0.0);
  vLight = vec3(0.0);
  vLength = 1.0;

  ivec2 size = textureSize(uCells, 0);
  int index = gl_InstanceID / uAxes;
  int axis = gl_InstanceID - index * uAxes;
  ivec2 cell = ivec2(index - (index / size.x) * size.x, index / size.x);
  float peak = luma(cellAt(cell, size));
  // A cheap reject first: even the whole neighbourhood at this cell's light spikes too short.
  if (visibleLength(9.0 * peak * uCellArea) < LENS_SHORTEST) return;

  vec3 light = vec3(0.0);
  for (int dy = -1; dy <= 1; dy++) {
    for (int dx = -1; dx <= 1; dx++) {
      vec3 v = cellAt(cell + ivec2(dx, dy), size);
      float l = luma(v);
      bool earlier = dy < 0 || (dy == 0 && dx < 0);
      if (l > peak || (l == peak && earlier)) return;
      light += v;
    }
  }
  float ring = 0.0;
  for (int dy = -2; dy <= 2; dy++) {
    for (int dx = -2; dx <= 2; dx++) {
      if (max(abs(dx), abs(dy)) == 2) ring += luma(cellAt(cell + ivec2(dx, dy), size));
    }
  }
  light *= (1.0 - smoothstep(0.25, 0.6, ring / (16.0 * max(peak, 1e-6)))) * uCellArea;
  if (uFull > 0.0) {
    float share = min(luma(light) / uFull, 1.0);
    light *= share * share;
  }
  float halfLength = min(uReach, visibleLength(luma(light)));
  if (halfLength < LENS_SHORTEST) return;

  // Where the light sits: its centre in the finer level, over the same 3 × 3 cells.
  ivec2 fine = textureSize(uFine, 0);
  int span = 3 * max(1, int(floor(float(fine.x) / float(size.x) + 0.5)));
  ivec2 from = ivec2(floor((vec2(cell) - 1.0) / vec2(size) * vec2(fine)));
  vec3 sum = vec3(0.0);
  float spread = 0.0;
  for (int j = 0; j < LENS_FINE_SPAN; j++) {
    if (j >= span) break;
    for (int i = 0; i < LENS_FINE_SPAN; i++) {
      if (i >= span) break;
      ivec2 f = from + ivec2(i, j);
      if (any(lessThan(f, ivec2(0))) || any(greaterThanEqual(f, fine))) continue;
      float w = luma(texelFetch(uFine, f, 0).rgb);
      vec2 c = vec2(f) + 0.5;
      sum += vec3(c * w, w);
      spread += dot(c, c) * w;
    }
  }
  vec2 at = sum.z > 0.0 ? sum.xy / sum.z / vec2(fine) : (vec2(cell) + 0.5) / vec2(size);
  // The light's radius, in cells: E[c²] − E[c]², from fine texels.
  vec2 mean = sum.xy / max(sum.z, 1e-6);
  float radius = sqrt(max(spread / max(sum.z, 1e-6) - dot(mean, mean), 0.0)) * float(size.x) / float(fine.x);
  vLight = light * (1.0 - smoothstep(0.5, 0.8, radius));
  if (luma(vLight) <= 0.0) return;
  at *= uFrame;

  float angle = HALF_PI + PI * float(axis) / float(uAxes);
  vec2 along = vec2(cos(angle), sin(angle));
  vec2 across = vec2(-along.y, along.x);
  vLine = position.xy * vec2(halfLength, 3.0 * uWidth + 2.0);
  vLength = halfLength;
  vec2 p = at + along * vLine.x + across * vLine.y;
  gl_Position = vec4(p / uFrame * 2.0 - 1.0, 0.0, 1.0);
}
