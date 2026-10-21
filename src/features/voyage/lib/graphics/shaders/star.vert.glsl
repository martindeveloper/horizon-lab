// The bright stars as a ship sees them: each star at its real distance, so the sky shifts
// (parallax) as the ship covers light-years; at speed the sky crowds ahead (aberration) and
// each star's light shifts (Doppler), its colour read from a blackbody lookup at its
// temperature times the Doppler factor and its flux raised by the factor's square (a point
// source: photons arrive D times as often, each D times as energetic; the band and the
// background, surface brightness, go as D⁴, which the crowding of these points reproduces).
// With SURFACE the points stand for the band's surface: the crowding already packs D² of them
// into each patch ahead, so each carries the rest of the patch's D⁴, eased as the glow is.
// `color` is the catalogue's colour, whose largest channel carries the magnitude weight.
// The Milky Way's painted grains and field stars draw with the same shader, at a far distance.
// A catalogue star another layer draws as discs once the ship is near (`handover`) gives way
// as that layer takes over (`handedOver`, from the CPU, where the ship's place is exact).

attribute float size;        // pixels at device-pixel-ratio 1
attribute float distance;    // parsecs
attribute float temperature; // kelvin

uniform float dpr;
uniform vec3 shipPc;         // the ship from the Sun, parsecs
uniform vec3 forward;        // the ship's direction of travel, unit
uniform float beta;          // v / c
uniform float gamma;
uniform sampler2D bbLut; // blackbody colours, log-spaced in temperature (`blackbodyLut`)
uniform vec3 bbLutSpec; // its lowest and highest temperature, kelvin, and its width in texels
uniform float radius;        // the sky sphere's radius, world units
uniform float fade;          // presence 0–1 (a painted sky gives way to the Galaxy map)
uniform float peak;          // the most beaming may brighten a point, or with SURFACE its patch
uniform vec3 tint;           // extinction colour
#ifndef SURFACE
attribute float handover;    // 1 for a star another layer takes over near it, else 0
uniform float handedOver;    // how far that layer has taken over, 0–1
#endif

varying vec3 vColor;

#include <horizon/relativity>
#include <horizon/temperature>

void main() {
  vec3 at = position * distance - shipPc;
  vec3 n = normalize(at);
  float cosTheta = dot(n, forward);
  vec3 seen = aberrate(n, forward, beta, gamma);
  float D = dopplerFactor(beta, gamma, cosTheta);
  float u = blackbodyLutTexel(temperature * D, bbLutSpec);
  float weight = max(color.r, max(color.g, color.b));
  /* A point's flux goes as D², a surface's as D⁴, eased toward the peak so the sky ahead brightens without burning out. */
#ifdef SURFACE
  float brightness = weight * beamingSeen(D * D * D * D, peak) / (D * D);
#else
  float brightness = weight * beamingSeen(D * D, peak) * (1.0 - handover * handedOver);
#endif
  /* A star at 1,000 pc in the catalogue is where it was; nearer ones dim or brighten by the inverse square of the ship's distance to them. */
  float near = 1.0 / max(dot(at, at) / (distance * distance), 1e-6);
  vColor = tint * texture2D(bbLut, vec2(u, 0.5)).rgb * brightness * min(near, 400.0) * fade;

  gl_Position = projectionMatrix * viewMatrix * vec4(seen * radius, 1.0);
  gl_PointSize = size * dpr * (0.8 + 0.2 * min(D, 2.0));
}
