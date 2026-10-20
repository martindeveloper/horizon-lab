// Finishes a bloomed frame: the ray shader's radiance (uImage, a half-float frame, one pixel =
// uTexel) plus the bloom chain's glow (uBloom, uBloomStrength times, in the same units), through
// the display pipeline (display.glsl) onto the canvas. createFullscreenPass draws it when bloom
// is on; without bloom the ray shader displays its own pixels.

uniform sampler2D uImage;
uniform vec2 uTexel;
uniform sampler2D uBloom;
uniform float uBloomStrength;
uniform vec2 uResolution;
uniform float uExposure;
uniform float uVignette;

#include "./display.glsl"

void main() {
  vec2 uv = gl_FragCoord.xy * uTexel;
  vec3 radiance = texture2D(uImage, uv).rgb + uBloomStrength * texture2D(uBloom, uv).rgb;
  gl_FragColor = vec4(display(radiance, gl_FragCoord.xy), 1.0);
}
