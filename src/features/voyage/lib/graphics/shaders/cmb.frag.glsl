// The microwave background as the ship sees it: 2.7 K today, cooler as the universe expands,
// and, seen from a ship, blue-shifted ahead by the Doppler factor from the observed angle.
// Only a ship moving fast enough that the factor lifts the background's temperature past red
// heat sees anything: the sky ahead glows in blackbody colour, its brightness going as the
// fourth power of the temperature.

uniform vec3 forward;      // the ship's direction of travel, unit
uniform float beta;        // v / c
uniform float gamma;
uniform float kelvin;      // the background's temperature at rest, now
uniform sampler2D bbLut; // blackbody colours, log-spaced in temperature (`blackbodyLut`)
uniform vec3 bbLutSpec; // its lowest and highest temperature, kelvin, and its width in texels
uniform float visibleK;    // the temperature at which the glow reads as full brightness

varying vec3 vDirection;

#include <horizon/relativity>
#include <horizon/temperature>

void main() {
  vec3 n = normalize(vDirection);
  float D = dopplerFactorObserved(beta, gamma, dot(n, forward));
  float seen = kelvin * D;
  float u = blackbodyLutTexel(seen, bbLutSpec);
  vec3 tint = texture2D(bbLut, vec2(u, 0.5)).rgb;
  float ratio = seen / visibleK;
  float radiance = min(ratio * ratio * ratio * ratio, 1.0);
  gl_FragColor = linearToOutputTexel(vec4(tint * radiance, 1.0));
}
