// Milky Way band: looks up two painted maps in galactic coordinates (today's
// thin disk with dust, and the early thick disk) and blends them by era.
// The galactic frame is passed as three unit vectors so the band can turn
// with the Sun's orbit around the Galaxy. With RELATIVITY the band is drawn
// as a fast ship sees it: each pixel's rest-frame direction is found by undoing
// the aberration, and its light is shifted by the Doppler factor (brightness
// as D⁴, colour as a blackbody of the band's mean temperature). The brightening is shown as
// an eye adapting to it (beamingSeen) and the colour shifts hue only, so the band ahead turns
// bluer and brighter and keeps its lanes instead of burning into a white sheet.

uniform sampler2D today;  // thin disk, bulge, Great Rift, Coalsack
uniform sampler2D early;  // thicker, bluer disk without the dust lane
uniform vec3 centre;      // direction of the galactic centre (l = 0)
uniform vec3 east;        // direction of l = 90°
uniform vec3 pole;        // north galactic pole (b = 90°)
uniform float era;        // 0 = early disk, 1 = today
uniform float strength;   // overall brightness, already dimmed for extinction
uniform vec3 tint;        // extinction colour

varying vec3 vDir;

#include <horizon/math>
#include <horizon/relativity>
#include <horizon/temperature>

#ifdef RELATIVITY
uniform vec3 forward;     // the ship's direction of travel, unit
uniform float beta;       // v / c
uniform float gamma;
uniform sampler2D bbLut; // blackbody colours, log-spaced in temperature (`blackbodyLut`)
uniform vec3 bbLutSpec; // its lowest and highest temperature, kelvin, and its width in texels
uniform float peak;       // the most the Doppler factor's D⁴ may brighten the glow, approached softly

// The disk's integrated starlight is about a G star's colour.
const float BAND_KELVIN = 5500.0;
// Rec. 709 luminance weights, for the blackbody's hue at unit brightness.
const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);

// A blackbody's colour at unit luminance: its hue, the brightness left to the D⁴ term.
vec3 blackbodyHue(float kelvin) {
  float u = blackbodyLutTexel(kelvin, bbLutSpec);
  vec3 colour = texture2D(bbLut, vec2(u, 0.5)).rgb;
  return colour / max(dot(colour, LUMA), 1e-3);
}
#endif

void main() {
  vec3 d = normalize(vDir);
  vec3 shift = vec3(1.0);
#ifdef RELATIVITY
  if (beta > 0.0) {
    float D = dopplerFactorObserved(beta, gamma, dot(d, forward));
    d = aberrate(d, forward, -beta, gamma);
    shift = beamingSeen(D * D * D * D, peak) * blackbodyHue(BAND_KELVIN * D) / blackbodyHue(BAND_KELVIN);
  }
#endif

  // Galactic longitude and latitude of this view direction.
  float x = dot(d, centre);
  float y = dot(d, east);
  float z = dot(d, pole);
  float l = atan(y, x) / TWO_PI;                    // wraps; the texture repeats in u
  float b = asin(clamp(z, -1.0, 1.0)) / PI + 0.5;   // 0 = south pole, 1 = north pole
  vec2 uv = vec2(l, b);

#ifdef TODAY_ONLY
  vec4 band = texture2D(today, uv);
#else
  vec4 band = mix(texture2D(early, uv), texture2D(today, uv), era);
#endif

  // Additive blending: alpha is folded into the colour.
  gl_FragColor = vec4(band.rgb * band.a * strength * tint * shift, 1.0);
}
