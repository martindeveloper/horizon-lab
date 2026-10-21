// A streak of dust: a soft core across the ribbon, bright at the head and fading along the
// tail, in its tint, added over the scene.

varying float vAlong;
varying float vSide;
varying float vAlpha;
varying vec3 vTint;

#include <horizon/log-depth>

void main() {
  logDepthFragment();
  /* Soft across the ribbon, a gentle swell near the head, nothing left at the tail. */
  float across = max(0.0, 1.0 - vSide * vSide);
  across *= across * across;
  float t = 1.0 - vAlong;
  float along = t * t * (3.0 - 2.0 * t) * (0.55 + 0.45 * t);
  float a = vAlpha * across * along * 0.6;
  /* A whiter core down the middle of the head. */
  vec3 colour = mix(vTint, vec3(1.0), 0.3 * across * t) * a;
  gl_FragColor = linearToOutputTexel(vec4(colour, 1.0));
}
