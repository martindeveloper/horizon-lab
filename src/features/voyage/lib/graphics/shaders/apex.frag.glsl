// The apex glow: a soft core in a wider halo, both gone by the quad's edge, added over
// the scene in its tint. Analytic only, no noise, no discard: it costs a few operations a pixel.

uniform float intensity;
uniform vec3 tint;

varying vec2 vUv;

#include <horizon/log-depth>

void main() {
  logDepthFragment();
  float r2 = dot(vUv, vUv);
  float edge = max(0.0, 1.0 - r2);
  float a = intensity * (exp(-r2 * 18.0) + 0.22 * exp(-r2 * 5.5)) * edge * edge;
  gl_FragColor = linearToOutputTexel(vec4(tint * a, 1.0));
}
