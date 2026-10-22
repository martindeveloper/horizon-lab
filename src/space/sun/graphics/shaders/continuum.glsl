// A stellar surface's continuum from the table `continuumTable` builds (atmosphere.ts): its
// CIE/Planck colour, normalized, and log photopic radiance per temperature. The table is a
// nearest-filtered float texture interpolated by hand, so no float-linear extension is needed.
#include "./parameters.generated.glsl"

uniform highp sampler2D uSpectrum;

vec4 spectrumAt(float kelvin) {
  float at = clamp(log(max(kelvin, SPECTRUM_MIN_K) / SPECTRUM_MIN_K)
    / log(SPECTRUM_MAX_K / SPECTRUM_MIN_K), 0.0, 1.0) * float(SPECTRUM_SAMPLES - 1);
  float lo = floor(at);
  vec4 a = texture2D(uSpectrum, vec2((lo + 0.5) / float(SPECTRUM_SAMPLES), 0.5));
  vec4 b = texture2D(uSpectrum, vec2((min(lo + 1.0, float(SPECTRUM_SAMPLES - 1)) + 0.5) / float(SPECTRUM_SAMPLES), 0.5));
  return mix(a, b, at - lo);
}

// Continuum colour and brightness against a reference surface's log radiance, before tone mapping.
vec3 glowAt(float kelvin, float referenceLogY) {
  vec4 light = spectrumAt(kelvin);
  return light.rgb * exp(light.a - referenceLogY);
}
