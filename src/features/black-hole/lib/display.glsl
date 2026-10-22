// The observatory's display pipeline, shared by the ray shader (drawing straight to the
// canvas) and the resolve shader (finishing a bloomed radiance frame): the lens vignette,
// exposure and the filmic tone map on linear light, the grade's contrast (DISPLAY_CONTRAST,
// lib/tone.ts), then the sRGB transfer curve with a dither of about one 8-bit step
// (<horizon/display>), since the pass's canvas leaves colours as written. The including shader
// declares uResolution, uExposure (the tone map's, frame.ts) and uVignette (the vignette's
// depth for this camera) before this include. The tone map and the grade work in units of
// the canvas's peak (<horizon/display-peak>), in its primaries, so a wide-colour canvas keeps
// the disk's hottest colours where sRGB would clip them.

#include "./parameters.generated.glsl"
#include <horizon/tonemap>
#include <horizon/display-peak>
#include <horizon/display>

vec3 display(vec3 radiance, vec2 fragCoord) {
  vec2 uv = (fragCoord - 0.5 * uResolution) / uResolution.y;
  vec3 col = toPeak(radiance * (1.0 - uVignette * dot(uv, uv)));
  vec3 toned = tonemap(max(col, vec3(0.0)), uExposure);
  return displayEncode(fromPeak(pow(toned, vec3(DISPLAY_CONTRAST))));
}
