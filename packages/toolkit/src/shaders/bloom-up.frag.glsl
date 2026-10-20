// One step up the bloom chain (dual Kawase, after Bjørge 2015): the destination is twice
// the source's size; each of its pixels reads the source through a tent of eight bilinear
// taps, the four axis taps a destination pixel away once and the four diagonal taps half
// a pixel away (uHalfPixel) twice, then adds the chain's own level at this size (uLevel),
// so the finest blur returns with every coarser one summed into it.

uniform sampler2D uImage;
uniform sampler2D uLevel;
uniform vec2 uHalfPixel;

void main() {
  vec2 uv = gl_FragCoord.xy * 2.0 * uHalfPixel;
  vec2 h = uHalfPixel;
  vec3 sum = texture2D(uImage, uv + vec2(-2.0 * h.x, 0.0)).rgb;
  sum += texture2D(uImage, uv + vec2(-h.x, h.y)).rgb * 2.0;
  sum += texture2D(uImage, uv + vec2(0.0, 2.0 * h.y)).rgb;
  sum += texture2D(uImage, uv + vec2(h.x, h.y)).rgb * 2.0;
  sum += texture2D(uImage, uv + vec2(2.0 * h.x, 0.0)).rgb;
  sum += texture2D(uImage, uv + vec2(h.x, -h.y)).rgb * 2.0;
  sum += texture2D(uImage, uv + vec2(0.0, -2.0 * h.y)).rgb;
  sum += texture2D(uImage, uv + vec2(-h.x, -h.y)).rgb * 2.0;
  gl_FragColor = vec4(sum * (1.0 / 12.0) + texture2D(uLevel, uv).rgb, 1.0);
}
