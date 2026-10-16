// Milky Way band: looks up two painted maps in galactic coordinates (today's
// thin disk with dust, and the early thick disk) and blends them by era.
// The galactic frame is passed as three unit vectors so the band can turn
// with the Sun's orbit around the Galaxy.

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

void main() {
  vec3 d = normalize(vDir);

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
  gl_FragColor = vec4(band.rgb * band.a * strength * tint, 1.0);
}
