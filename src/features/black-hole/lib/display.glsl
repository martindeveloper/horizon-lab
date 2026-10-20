// The observatory's display pipeline, shared by the ray shader (drawing straight to the
// canvas) and the resolve shader (finishing a bloomed radiance frame): the lens vignette,
// exposure and the filmic tone map, a 0.97 gamma that keeps highlight detail instead of a
// second clipping boost, and a dither of about one 8-bit step, which hides banding without
// visible grain. The including shader declares uResolution, uExposure and uVignette (the
// vignette's depth for this camera, written by frame.ts) before this include. uGamut (the
// pass's: linear sRGB to the canvas's primaries, the identity for an sRGB canvas) moves the
// radiance into the canvas's gamut before the tone map, so a wide-colour canvas keeps the
// disk's hottest colours where sRGB would clip them.

#include <horizon/noise>
#include <horizon/tonemap>

uniform mat3 uGamut;

vec3 display(vec3 radiance, vec2 fragCoord) {
  vec2 uv = (fragCoord - 0.5 * uResolution) / uResolution.y;
  vec3 col = uGamut * (radiance * (1.0 - uVignette * dot(uv, uv)));
  col = tonemap(max(col, vec3(0.0)), uExposure);
  col = pow(col, vec3(0.97));
  return col + (hash21(gl_FragCoord.xy) - 0.5) * 0.004;
}
