// One step down the bloom chain (dual Kawase, after Bjørge 2015): the destination is half
// the source's size and each of its pixels averages five bilinear taps of the source, the
// centre four times and the four diagonal corners a destination half-pixel away
// (uHalfPixel) once. Four such taps together read a 4 × 4 block, so the chain blurs as it
// shrinks and no step reads more than it needs.
//
// With HORIZON_BLOOM_PREFILTER defined this is the first step, from the frame itself: only
// light above uThreshold blooms, eased in over a knee uKnee wide below it (Unity's soft
// knee), and a pixel's contribution is capped at uClamp so one hot pixel cannot flood the
// chain. The threshold is in the frame's own units: display values for an 8-bit frame,
// radiance for a floating-point one.

uniform sampler2D uImage;
uniform vec2 uHalfPixel;
uniform float uThreshold;
uniform float uKnee;
uniform float uClamp;

vec3 tap(vec2 uv) {
  vec3 c = texture2D(uImage, uv).rgb;
#ifdef HORIZON_BLOOM_PREFILTER
  c = min(c, vec3(uClamp));
  float brightness = max(c.r, max(c.g, c.b));
  float soft = clamp(brightness - uThreshold + uKnee, 0.0, 2.0 * uKnee);
  soft = soft * soft / (4.0 * uKnee + 1e-4);
  float share = max(soft, brightness - uThreshold) / max(brightness, 1e-4);
  c *= share;
#endif
  return c;
}

void main() {
  vec2 uv = gl_FragCoord.xy * 2.0 * uHalfPixel;
  vec3 sum = tap(uv) * 4.0;
  sum += tap(uv - uHalfPixel);
  sum += tap(uv + uHalfPixel);
  sum += tap(uv + vec2(uHalfPixel.x, -uHalfPixel.y));
  sum += tap(uv - vec2(uHalfPixel.x, -uHalfPixel.y));
  gl_FragColor = vec4(sum * (1.0 / 8.0), 1.0);
}
