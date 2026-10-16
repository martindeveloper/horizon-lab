// Sky star point: a soft Gaussian disc, additively blended, tinted by the
// extinction colour of the moment (reddened inside the natal cloud).

uniform vec3 tint;

varying vec3 vColor;

#include <horizon/sprite>

void main() {
  float a = pointGlow(gl_PointCoord, 2.6);

  gl_FragColor = vec4(vColor * tint * a, a);
}
