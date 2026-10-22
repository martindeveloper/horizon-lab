// A continuous temperature field for ordinary cool stars (including K giants). Coordinates
// are in the pressure-scale-height cell units supplied by the caller. This is an illustrative
// convection pattern, not an RHD solution or a measured surface map.
#include <horizon/convection>

// Returns temperature perturbation, cool-lane coverage, and a smoothly blended cell seed.
// Hot upflows occupy broad interiors; cool downflows have irregular, finite-width lanes.
vec3 granuleField(vec3 p, float time, float fineDetail) {
  vec3 flow = 0.22 * sin(p.yzx * 2.4
    + 0.6 * sin(p.zxy * 1.3 + vec3(1.7, 4.1, 2.3)) + time * 0.04);
  vec3 advected = p + flow;
  // Blending contributions from neighbouring upflows avoids the straight F2-F1 borders
  // and abrupt per-cell brightness ownership of a hard Voronoi tessellation.
  vec2 cells = softConvectionCells(advected, time * 0.45, 9.0);
  float broad = gradientNoise3(p * 0.9 + vec3(0.0, time * 0.025, 7.3));
  float width = 0.22 + 0.07 * broad;
  float lane = smoothstep(0.50 + 0.05 * broad, 0.50 + 0.05 * broad + width, cells.x);
  // A continuous plume profile avoids flat light/dark islands: temperature falls gradually
  // from each upflow into the surrounding downflow, including inside both regions.
  float plume = exp(-(2.2 + 0.6 * broad) * cells.x * cells.x);
  float hot = 0.8 + 0.4 * cells.y + 0.25 * broad;
  float temperature = 2.0 * (hot * plume - 0.62);
  // Texture within an upflow disappears at its own projected resolution. Changing quality
  // or zoom never changes the cell positions or their characteristic physical scale.
  if (fineDetail > 0.0) {
    float texture = gradientNoise3(advected * 2.7 + vec3(11.4, 0.0, time * 0.035));
    temperature += 0.45 * fineDetail * texture * (1.0 - 0.65 * lane);
  }
  return vec3(clamp(temperature, -1.0, 1.0), lane, cells.y);
}
