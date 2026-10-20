// One line of a diffraction star (lens-star.vert.glsl): a thin vane spreads a point of light
// into a line across it whose brightness falls as 1/r² from a small core, and longer
// wavelengths spread further (as the square of the wavelength), so a spike is white near its
// light and reddens towards its tip. Across, the line is a Gaussian of uWidth frame pixels,
// box-filtered over the target's texel (uTexelFrame frame pixels wide), so it stays as bright
// and as steady at any resolution. Along, each channel is a Lorentzian of its own core, which
// integrates to one, so a spike carries its light's energy (vLight) whatever its colour; the
// last half of its drawn length fades out. Written additively, in density per frame pixel.

uniform float uWidth;
uniform float uCore;
uniform float uTexelFrame;

varying vec2 vLine;
varying vec3 vLight;
varying float vLength;

#include <horizon/math>

#define LENS_CHROMA vec3(1.41, 1.0, 0.77)

float erfApprox(float x) {
  float x2 = x * x;
  float a = 0.147;
  float e = sqrt(1.0 - exp(-x2 * (4.0 / PI + a * x2) / (1.0 + a * x2)));
  return x < 0.0 ? -e : e;
}

void main() {
  float s = abs(vLine.x);
  float h = 0.5 * uTexelFrame;
  float k = 1.0 / (uWidth * 1.41421356);
  float across = (erfApprox((vLine.y + h) * k) - erfApprox((vLine.y - h) * k)) / (4.0 * h);
  vec3 core = uCore * LENS_CHROMA;
  vec3 along = core / (PI * (core * core + s * s));
  float fade = 1.0 - smoothstep(0.5 * vLength, vLength, s);
  gl_FragColor = vec4(vLight * along * (across * fade), 1.0);
}
