precision highp float;
#include "./sun-common.glsl"
#include <horizon/srgb>
uniform float uFlow;
uniform float uPresence;
varying vec2 vDisc;
varying vec3 vWorld;
void main() {
  float r2 = dot(vDisc, vDisc);
  if (r2 > 1.0) discard;
  if (uLightMode == LIGHT_ECLIPSE && length(cross(normalize(vWorld - cameraPosition), cameraPosition)) < 1.0) discard;
  // A teaching overlay of advected plasma parcels, not a prediction of emission or density.
  float a = exp(-5.0 * r2) * uFlow * uPresence;
  vec3 colour = uLightMode == LIGHT_BAND ? rampAt(2.0 * a) : uGold * a;
  gl_FragColor = vec4(encodeSrgb(uGamut * colour), 1.0);
}
