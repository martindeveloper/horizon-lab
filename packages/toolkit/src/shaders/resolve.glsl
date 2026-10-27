// Finishes a bloomed or lensed frame onto the canvas: the scene's radiance (uImage, a half-float
// frame, one pixel = uTexel), with HORIZON_LENS defined fringed towards the corners and with the
// lens pass's diffraction spikes added (lens.glsl), plus the bloom chain's glow (uBloom,
// uBloomStrength times, in the same units), through the including shader's display step,
// `vec3 display(vec3 radiance, vec2 fragCoord)`, declared before this include. A pass draws
// it (createFullscreenPass) while bloom or the lens is on; otherwise the scene shader displays
// its own pixels.

uniform sampler2D uImage;
uniform vec2 uTexel;
uniform sampler2D uBloom;
uniform float uBloomStrength;

#include <horizon/lens>

void main() {
  vec2 uv = gl_FragCoord.xy * uTexel;
  vec3 radiance = texture2D(uImage, uv).rgb;
#ifdef HORIZON_LENS
  radiance = lensSpikes(lensFringe(radiance, uv), uv);
#endif
  radiance += uBloomStrength * texture2D(uBloom, uv).rgb;
  gl_FragColor = vec4(display(radiance, gl_FragCoord.xy), 1.0);
}
