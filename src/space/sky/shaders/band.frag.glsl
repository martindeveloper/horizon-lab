// Milky Way band: looks up two painted maps in galactic coordinates (today's
// thin disk with dust, and the early thick disk) and blends them by era.
// The galactic frame is passed as three unit vectors so the band can turn
// with the Sun's orbit around the Galaxy. With RELATIVITY the band is drawn
// as a fast ship sees it: each pixel's rest-frame direction is found by undoing
// the aberration, and its light is shifted by the Doppler factor (brightness
// as D⁴, colour as a blackbody of the band's mean temperature).

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

#ifdef RELATIVITY
uniform vec3 forward;     // the ship's direction of travel, unit
uniform float beta;       // v / c
uniform float gamma;
uniform sampler2D bbLut;  // blackbody colours, log-spaced from lutRange.x to lutRange.y kelvin
uniform vec2 lutRange;

// The disk's integrated starlight is about a G star's colour.
const float BAND_KELVIN = 5500.0;
// The most the Doppler factor may brighten the glow: past this the sky ahead is a white sheet.
const float BAND_PEAK = 6.0;

vec3 blackbody(float kelvin) {
  float u = clamp(log(kelvin / lutRange.x) / log(lutRange.y / lutRange.x), 0.0, 1.0);
  return texture2D(bbLut, vec2(u, 0.5)).rgb;
}
#endif

void main() {
  vec3 d = normalize(vDir);
  vec3 shift = vec3(1.0);
#ifdef RELATIVITY
  if (beta > 0.0) {
    float D = dopplerFactorObserved(beta, gamma, dot(d, forward));
    d = aberrate(d, forward, -beta, gamma);
    shift = min(D * D * D * D, BAND_PEAK) * blackbody(BAND_KELVIN * D) / max(blackbody(BAND_KELVIN), vec3(1e-3));
  }
#endif

  // Galactic longitude and latitude of this view direction.
  float x = dot(d, centre);
  float y = dot(d, east);
  float z = dot(d, pole);
  float l = atan(y, x) / TWO_PI;                    // wraps; the texture repeats in u
  float b = asin(clamp(z, -1.0, 1.0)) / PI + 0.5;   // 0 = south pole, 1 = north pole
  vec2 uv = vec2(l, b);

  vec4 now = texture2D(today, uv);
  vec4 was = texture2D(early, uv);
  vec4 band = mix(was, now, era);

  // Additive blending: alpha is folded into the colour.
  gl_FragColor = vec4(band.rgb * band.a * strength * tint * shift, 1.0);
}
