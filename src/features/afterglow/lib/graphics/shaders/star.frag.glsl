// The photosphere: the shared CIE/Planck continuum at the Sun's temperature, Claret's limb
// darkening from the shared tables (`uProfile`, by μ), the shared granulation at the cells'
// true count across the radius (a few huge cells on the giant, hundreds on the Sun, none the
// dwarf resolves), exposed with the world's day side on the display's root. Seen from inside
// (the engulfed worlds) the back faces draw: the whole sky is the continuum.
#include <horizon/srgb>
#include <horizon/tonemap>
#include "./parameters.generated.glsl"
#include "../../../../../space/sun/graphics/shaders/continuum.glsl"
#include "../../../../../space/sun/graphics/shaders/granulation.glsl"

uniform highp sampler2D uProfile; // R,V,B limb darkening by μ
uniform float uKelvin;
// Today's photosphere's log radiance: what the continuum's brightness is measured against.
uniform float uRefLogY;
// The display's exposure after the root, and the convection cells across the radius.
uniform float uExposure;
uniform float uCells;
uniform float uTime;
// The drawn radius in its frame's pixels: whether a cell resolves.
uniform float uRadiusPx;

varying vec3 vPoint;
varying vec3 vNormal;
varying vec3 vView;

void main() {
  vec3 n = normalize(vNormal);
  float mu = gl_FrontFacing ? clamp(dot(n, normalize(vView)), 0.0, 1.0) : 1.0;
  /* Granulation at its true scale: the contrast of fine cells, or of a giant's few broad ones. */
  float across = max(uCells, 1.0);
  float contrast = mix(CELL_CONTRAST_GIANT, CELL_CONTRAST_FINE, smoothstep(0.1 * CELLS_FINE_FROM, CELLS_FINE_FROM, across));
  float pixelsPerCell = uRadiusPx * max(mu, 0.02) / across;
  float fine = resolvedPixels(pixelsPerCell);
  float dT = 0.0;
  if (fine > 0.0) {
    float interior = resolvedPixels(pixelsPerCell / 2.7);
    vec3 cells = granuleField(vPoint * across, uTime, interior);
    dT = contrast * fine * mix(0.35, 1.0, mu) * cells.x;
  }
  /* The display's root falls on the brightness alone: the continuum's hue and the limb's
     darkening stay as they are, so a red giant is red and its edge truly darker. */
  vec4 light = spectrumAt(uKelvin * (1.0 + dT));
  vec3 limb = tableAt(uProfile, mu, PROFILE_SAMPLES, 0, 1).rgb;
  float level = pow(exp(light.a - uRefLogY) * SUN_OVER_SUNLIGHT, DAY_GAMMA);
  vec3 shown = uExposure * level * max(light.rgb, 0.0) * limb;
  gl_FragColor = vec4(encodeSrgb(tonemapHue(shown, 1.0, 0.8, 1.0, HIGHLIGHT_WHITE)), 1.0);
}
