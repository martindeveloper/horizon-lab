// A star's disc by its temperature: the blackbody colour from the lookup, darkened toward
// the limb by Eddington's grey law I(μ)/I(1) = 0.4 + 0.6 μ. It is lit by nothing; it is
// the light. The vertex stage is the shared surface shader.

uniform float kelvin;
uniform sampler2D bbLut; // blackbody colours, log-spaced from lutRange.x to lutRange.y kelvin
uniform vec2 lutRange;

varying vec3 vNormal;
varying vec3 vView;

#include <horizon/log-depth>

void main() {
  logDepthFragment();
  float mu = clamp(dot(normalize(vNormal), normalize(vView)), 0.0, 1.0);
  float limb = 0.4 + 0.6 * mu;
  float u = clamp(log(kelvin / lutRange.x) / log(lutRange.y / lutRange.x), 0.0, 1.0);
  vec3 col = texture2D(bbLut, vec2(u, 0.5)).rgb * limb;
  gl_FragColor = linearToOutputTexel(vec4(col, 1.0));
}
