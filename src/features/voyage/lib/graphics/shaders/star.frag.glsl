// A star point: a soft Gaussian disc, additively blended, in the colour its vertex worked out.

varying vec3 vColor;

#include <horizon/sprite>

void main() {
  float a = pointGlow(gl_PointCoord, 2.6);
  gl_FragColor = vec4(vColor * a, a);
}
