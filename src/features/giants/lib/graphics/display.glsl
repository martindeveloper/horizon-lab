// Giants' display step, shared by the scene shader (drawing straight to the canvas) and the
// resolve shader (finishing a bloomed radiance frame): the tone curve to the canvas's peak, in
// its primaries (<horizon/display-peak>), then the orbits in the theme's gold, then the sRGB
// transfer curve with its dither (<horizon/display>).

#include "./parameters.generated.glsl"
#include <horizon/tonemap>
#include <horizon/display-peak>
#include <horizon/display>

uniform vec2 uResolution;               // drawing buffer, pixels
uniform float uPixelRatio;              // buffer pixels per CSS pixel
uniform float uLines;                   // the line art's presence (baseline, orbits): 0 while a drift veils it
uniform vec3 uOrbitCentre;              // centre x, y; 1 while any ring shows (0: none)
uniform vec2 uOrbits[ORBIT_COUNT];      // each ring's radius, CSS pixels, and how much of it shows
uniform vec3 uAccent;                   // the house gold, linear

vec3 display(vec3 radiance, vec2 fragCoord) {
  /* Hue kept through the tone curve, so a red star stays red and keeps its limb darkening. */
  vec3 shown = fromPeak(tonemapHue(toPeak(radiance), EXPOSURE, SHOULDER, SATURATION, HIGHLIGHT_WHITE));

  /* The orbits over everything, after the tone curve so their gold is the theme's: a dark
     casing either side of each line keeps it legible across a bright face as on the sky. */
  if (uOrbitCentre.z > 0.0 && uLines > 0.0) {
    vec2 p = vec2(fragCoord.x, uResolution.y - fragCoord.y) / uPixelRatio;
    float r = length(p - uOrbitCentre.xy);
    float line = 0.0;
    float casing = 0.0;
    for (int k = 0; k < ORBIT_COUNT; k++) {
      vec2 ring = uOrbits[k];
      float d = abs(r - ring.x);
      line = max(line, ring.y * (1.0 - smoothstep(0.35, 1.25, d)));
      casing = max(casing, ring.y * (1.0 - smoothstep(1.25, ORBIT_CASE_PX, d)));
    }
    shown *= 1.0 - ORBIT_CASE_DEPTH * casing * uLines;
    shown = mix(shown, uGamut * uAccent, ORBIT_LINE_ALPHA * line * uLines);
  }
  return displayEncode(shown);
}
