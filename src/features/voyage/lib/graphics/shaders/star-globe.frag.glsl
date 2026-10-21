// A star's disc by its temperature: the blackbody colour from the lookup, darkened toward
// the limb by Eddington's grey law I(μ)/I(1) = 0.4 + 0.6 μ (`eddingtonLimb`). It is lit by
// nothing; it is the light. The vertex stage is the shared surface shader.

uniform float kelvin;
uniform sampler2D bbLut; // blackbody colours, log-spaced in temperature (`blackbodyLut`)
uniform vec3 bbLutSpec; // its lowest and highest temperature, kelvin, and its width in texels

varying vec3 vNormal;
varying vec3 vView;

#include <horizon/log-depth>
#include <horizon/temperature>

void main() {
  logDepthFragment();
  float mu = clamp(dot(normalize(vNormal), normalize(vView)), 0.0, 1.0);
  float u = blackbodyLutTexel(kelvin, bbLutSpec);
  vec3 col = texture2D(bbLut, vec2(u, 0.5)).rgb * eddingtonLimb(mu);
  gl_FragColor = linearToOutputTexel(vec4(col, 1.0));
}
