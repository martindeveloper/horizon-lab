// Space behind the globe: black, the shared stars drawn over it; a Sun too small for its frame
// as a point with the eye's halo, the eye's glare about a resolved disc (there is no air here),
// and the nebula's glow from inside its shell. The globe and the Sun's globe are drawn after,
// each in a depth pass of its own.
#include <horizon/srgb>
#include <horizon/tonemap>
#include <horizon/gradient-noise>
#include "./parameters.generated.glsl"
#include "./view.glsl"

// The Sun's direction and angular radius (radians), its colour (linear, brightest channel 1).
uniform vec3 uSunDirWide;
uniform float uSunRadius;
uniform vec3 uSunColour;
// A point Sun's brightness; the disc's shown level at its centre, for the glare.
uniform float uPointBright;
uniform float uGlow;
// A pixel's angle in the wide view and in the disc's frame, radians.
uniform float uPixel;
uniform float uDiscPixel;
// The glare's switch (0 off).
uniform float uGlare;
// The nebula's glow, 0–1 (an illustration: [O III] green near the star, Hα red farther out).
uniform float uNebula;

varying vec2 vUv;

// How much of a disc the Sun is on the screen, 0 a point to 1 resolved: by its drawn size in
// its own frame, so a frame still closing on a small Sun shows a haloed point, never a speck.
float resolvedDisc() {
  return smoothstep(MIN_RADIUS_PX, RESOLVED_PX, uSunRadius / uDiscPixel);
}

void main() {
  vec3 dir = viewDirection(vUv);
  float angle = acos(clamp(dot(dir, uSunDirWide), -1.0, 1.0));
  float resolved = resolvedDisc();
  /* A point Sun: a spot of its drawn size and the eye's halo about it. */
  float r = max(uSunRadius, MIN_RADIUS_PX * uPixel);
  float spot = exp(-2.0 * angle * angle / (r * r));
  float halo = POINT_HALO * exp(-angle / (POINT_HALO_PX * uPixel));
  vec3 sky = uSunColour * uPointBright * (1.0 - resolved) * (spot + halo);
  /* The glare about a resolved disc, out to a few radii. */
  if (uGlare > 0.0 && resolved > 0.0) {
    float reach = min(max(uSunRadius * GLARE_REACH, 0.03), GLARE_REACH_MAX);
    sky += uSunColour * uGlow * uGlare * GLARE_STRENGTH * resolved * exp(-max(angle - uSunRadius, 0.0) / reach);
  }
  /* The shell's glow, brightest about the star, filaments over the whole sky; none before the nebula. */
  if (uNebula > 0.0) {
    float grain = 1.0 + NEBULA_GRAIN_DEPTH * gradientNoise3(dir * NEBULA_GRAIN);
    vec3 shell = mix(NEBULA_HALPHA_RGB, NEBULA_OIII_RGB, exp(-angle / NEBULA_CORE));
    sky += uNebula * NEBULA_LEVEL * shell * (NEBULA_FLOOR + exp(-angle / NEBULA_REACH)) * grain;
  }
  gl_FragColor = vec4(encodeSrgb(tonemapHue(sky, 1.0, 0.8, 1.0, HIGHLIGHT_WHITE)), 1.0);
}
