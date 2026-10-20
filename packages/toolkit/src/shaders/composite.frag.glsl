// The resolve of an offscreen frame onto the canvas, in one pass: the frame (uImage, one pixel
// = uTexel) is copied, or filtered by FXAA with HORIZON_FXAA defined; with HORIZON_LENS
// defined its colours fringe towards the corners and the lens pass's diffraction spikes are
// added (lens.glsl); with HORIZON_BLOOM defined the blurred bright light of the bloom chain
// (uBloom, at a lower resolution, read bilinearly) is added uBloomStrength times; and either
// effect ends in a dither of one 8-bit step, which hides the banding its smooth gradients
// would otherwise show. The frame holds display-ready bytes, encoded as the canvas would be,
// so the result is written as it is.

uniform sampler2D uImage;
uniform vec2 uTexel;
uniform sampler2D uBloom;
uniform float uBloomStrength;

#include <horizon/fxaa>
#include <horizon/lens>
#include <horizon/noise>

void main() {
  vec2 uv = gl_FragCoord.xy * uTexel;
#ifdef HORIZON_FXAA
  vec3 col = fxaa(uv);
#else
  vec3 col = texture2D(uImage, uv).rgb;
#endif
#ifdef HORIZON_LENS
  col = lensSpikes(lensFringe(col, uv), uv);
#endif
#ifdef HORIZON_BLOOM
  col += uBloomStrength * texture2D(uBloom, uv).rgb;
#endif
#if defined(HORIZON_BLOOM) || defined(HORIZON_LENS)
  col += (hash21(gl_FragCoord.xy) - 0.5) * (1.0 / 255.0);
#endif
  gl_FragColor = vec4(col, 1.0);
}
