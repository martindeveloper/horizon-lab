// The bright stars as a ship sees them: each star at its real distance, so the sky shifts
// (parallax) as the ship covers light-years; at speed the sky crowds ahead (aberration) and
// each star's light shifts (Doppler), its colour read from a blackbody lookup at its
// temperature times the Doppler factor and its flux raised by the factor's square (a point
// source: photons arrive D times as often, each D times as energetic; the band and the
// background, surface brightness, go as D⁴, which the crowding of these points reproduces).
// `color` is the catalogue's colour, whose largest channel carries the magnitude weight.
// The Milky Way's painted grains and field stars draw with the same shader, at a far distance.

attribute float size;        // pixels at device-pixel-ratio 1
attribute float distance;    // parsecs
attribute float temperature; // kelvin

uniform float dpr;
uniform vec3 shipPc;         // the ship from the Sun, parsecs
uniform vec3 forward;        // the ship's direction of travel, unit
uniform float beta;          // v / c
uniform float gamma;
uniform sampler2D bbLut;     // blackbody colours, log-spaced from lutRange.x to lutRange.y kelvin
uniform vec2 lutRange;
uniform float radius;        // the sky sphere's radius, world units
uniform float fade;          // presence 0–1 (a painted sky gives way to the Galaxy map)
uniform float peak;          // the most the Doppler factor may brighten a point (D² is clamped to it)
uniform vec3 tint;           // extinction colour

varying vec3 vColor;

#include <horizon/relativity>

void main() {
  vec3 at = position * distance - shipPc;
  vec3 n = normalize(at);
  float cosTheta = dot(n, forward);
  vec3 seen = aberrate(n, forward, beta, gamma);
  float D = dopplerFactor(beta, gamma, cosTheta);
  float kelvin = temperature * D;
  /* The lookup's coordinate, as blackbodyLutCoordinate in science/color.ts. */
  float u = clamp(log(kelvin / lutRange.x) / log(lutRange.y / lutRange.x), 0.0, 1.0);
  float weight = max(color.r, max(color.g, color.b));
  /* A point's flux goes as D²; clamped so the sky ahead saturates to white, not past it. */
  float brightness = weight * min(D * D, peak);
  /* A star at 1,000 pc in the catalogue is where it was; nearer ones dim or brighten by the inverse square of the ship's distance to them. */
  float near = 1.0 / max(dot(at, at) / (distance * distance), 1e-6);
  vColor = tint * texture2D(bbLut, vec2(u, 0.5)).rgb * brightness * min(near, 400.0) * fade;

  gl_Position = projectionMatrix * viewMatrix * vec4(seen * radius, 1.0);
  gl_PointSize = size * dpr * (0.8 + 0.2 * min(D, 2.0));
}
