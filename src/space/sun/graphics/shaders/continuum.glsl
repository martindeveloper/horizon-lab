// A stellar surface's continuum from the table `continuumTable` builds (atmosphere.ts): its
// CIE/Planck colour, normalized, and log photopic radiance per temperature. The table is a
// nearest-filtered float texture interpolated by hand, so no float-linear extension is needed.
#include <horizon/temperature>
#include "./sampling.glsl"

uniform highp sampler2D uSpectrum;

vec4 spectrumAt(float kelvin) {
  float x = blackbodyLutCoordinate(max(kelvin, SPECTRUM_MIN_K), vec2(SPECTRUM_MIN_K, SPECTRUM_MAX_K));
  return tableAt(uSpectrum, x, SPECTRUM_SAMPLES, 0, 1);
}

// Continuum colour and brightness against a reference surface's log radiance, before tone mapping.
vec3 glowAt(float kelvin, float referenceLogY) {
  vec4 light = spectrumAt(kelvin);
  return light.rgb * exp(light.a - referenceLogY);
}
