// Diffraction spikes (the lens pass), one instance per cell of the source level and line of a
// star: a telescope's spider vanes spread each point of light into thin lines across them, so
// a star is drawn on each bright, compact light rather than smeared over its whole shape.
//
// uCells is a coarse level of the bloom chain, each texel a cell of the frame holding the light
// above the bloom's threshold there. A cell is a candidate when it is the brightest of its
// 3 × 3 neighbourhood (ties go to the earlier cell, so a plateau lights once). Nothing else is
// decided per cell: the light is then measured in the finer level (uFine) through a Gaussian
// window a cell wide, centred on the light itself (the window's own light-weighted centre,
// refined twice from the coarse neighbourhood's), so its energy, its place and its size change
// smoothly as it moves across the frame or another light passes by, instead of stepping as
// one of them crosses a cell's edge. Only texels near the window's own peak count (a soft
// gate from LENS_GATE_FROM to LENS_GATE_TO of it): the specks of a belt or the field stars
// around a far Sun are many times dimmer once the chain has blurred them, so they neither
// pull the star about as they drift through nor widen the light. The energy is the window's
// light, in frame pixels of light (uFineArea); a point keeps all of it, and a light wider
// than the window loses most. A light whose root-mean-square radius passes half a cell (a
// disc filling the view, the black hole's disk, a galaxy's core) is no point: its spikes
// fade out as it grows.
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
uniform float uFineArea;  // frame px² per texel of uFine
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

// The window: two cells out from its centre, in fine texels, at most this many across.
#define LENS_WINDOW_REACH 8
#define LENS_WINDOW_SPAN 17
#define LENS_WINDOW_PASSES 3
#define LENS_GATE_FROM 0.12
#define LENS_GATE_TO 0.35
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

  // The candidate, and where its neighbourhood's light sits, in cells.
  vec2 coarse = vec2(0.0);
  float coarseLight = 0.0;
  for (int dy = -1; dy <= 1; dy++) {
    for (int dx = -1; dx <= 1; dx++) {
      float l = luma(cellAt(cell + ivec2(dx, dy), size));
      bool earlier = dy < 0 || (dy == 0 && dx < 0);
      if (l > peak || (l == peak && earlier)) return;
      coarse += (vec2(cell + ivec2(dx, dy)) + 0.5) * l;
      coarseLight += l;
    }
  }
  if (coarseLight <= 0.0) return;

  // The light through a Gaussian window a cell wide in the finer level, centred on itself.
  ivec2 fine = textureSize(uFine, 0);
  vec2 perCell = vec2(fine) / vec2(size);
  float sigma = max(perCell.x, 1.0);
  int reach = min(LENS_WINDOW_REACH, int(ceil(2.0 * sigma)));
  vec2 centre = coarse / coarseLight * perCell;
  vec3 colour = vec3(0.0);
  float weight = 0.0;
  float second = 0.0;
  // The first pass only finds the window's peak and a first centre; the gate needs the peak.
  float brightest = 0.0;
  for (int pass = 0; pass < LENS_WINDOW_PASSES; pass++) {
    colour = vec3(0.0);
    weight = 0.0;
    second = 0.0;
    vec2 first = vec2(0.0);
    float top = 0.0;
    ivec2 from = ivec2(floor(centre)) - reach;
    for (int j = 0; j < LENS_WINDOW_SPAN; j++) {
      if (j > 2 * reach) break;
      for (int i = 0; i < LENS_WINDOW_SPAN; i++) {
        if (i > 2 * reach) break;
        ivec2 f = from + ivec2(i, j);
        if (any(lessThan(f, ivec2(0))) || any(greaterThanEqual(f, fine))) continue;
        vec3 v = texelFetch(uFine, f, 0).rgb;
        float l = luma(v);
        top = max(top, l);
        vec2 c = vec2(f) + 0.5;
        vec2 d = c - centre;
        float g = exp(-0.5 * dot(d, d) / (sigma * sigma));
        if (pass > 0) g *= smoothstep(LENS_GATE_FROM * brightest, LENS_GATE_TO * brightest, l);
        float w = l * g;
        colour += v * g;
        weight += w;
        first += c * w;
        second += dot(c, c) * w;
      }
    }
    if (weight <= 0.0) return;
    centre = first / weight;
    brightest = top;
  }

  vec3 light = colour * uFineArea;
  if (uFull > 0.0) {
    float share = min(luma(light) / uFull, 1.0);
    light *= share * share;
  }
  // The light's radius, in cells: E[c²] − E[c]², from fine texels.
  float radius = sqrt(max(second / weight - dot(centre, centre), 0.0)) / perCell.x;
  vLight = light * (1.0 - smoothstep(0.5, 0.8, radius));
  float halfLength = min(uReach, visibleLength(luma(vLight)));
  if (halfLength < LENS_SHORTEST) return;
  vec2 at = centre / vec2(fine) * uFrame;

  float angle = HALF_PI + PI * float(axis) / float(uAxes);
  vec2 along = vec2(cos(angle), sin(angle));
  vec2 across = vec2(-along.y, along.x);
  vLine = position.xy * vec2(halfLength, 3.0 * uWidth + 2.0);
  vLength = halfLength;
  vec2 p = at + along * vLine.x + across * vLine.y;
  gl_Position = vec4(p / uFrame * 2.0 - 1.0, 0.0, 1.0);
}
