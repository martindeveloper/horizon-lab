// Swarm point: a soft disc with the body's tint. Nearly invisible fragments
// are discarded so thousands of overlapping points stay cheap.

uniform float opacity;

varying vec3 vColor;
varying float vAlpha;

#include <horizon/sprite>

void main() {
  float a = pointGlow(gl_PointCoord, 2.2) * opacity * vAlpha;
  if (a < 0.004) discard;

  gl_FragColor = vec4(vColor * a, a);
}
