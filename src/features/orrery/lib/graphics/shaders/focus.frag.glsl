// Selection reticle, in the Horizon language: a gold hairline circle with a
// soft glow and four short ticks, like a finder's crosshair held off the body.
// `lock` runs 0 → 1 as a selection settles: the circle draws in from wider and
// the ticks slide home. Widths are in screen pixels, so the lines stay crisp
// at any distance.

uniform vec3 color;
uniform float opacity;
uniform float lock;    // 0 → 1 as a new selection settles
uniform float breath;  // 0..1, a slow swell of the glow

varying vec2 vUv;      // −1…1 across the quad

void main() {
  float r = length(vUv);
  float px = max(fwidth(r), 1e-4);  // quad units per pixel

  // The circle: ~1.25 px hairline, closing in from wider as it locks.
  float ringR = mix(0.84, 0.62, lock);
  float d = abs(r - ringR) / px;
  float line = 1.0 - smoothstep(0.35, 1.25, d);
  float glow = exp(-d * d / 32.0) * (0.16 + 0.1 * breath);

  // Ticks on the four axes, just outside the circle, sliding in as it locks.
  float slide = (1.0 - lock) * 0.18;
  float inner = ringR + 0.12 + slide;
  float outer = ringR + 0.3 + slide;
  float across = min(abs(vUv.x), abs(vUv.y)) / px;
  float along = smoothstep(inner - px, inner + px, r) * (1.0 - smoothstep(outer - px, outer + px, r));
  float tick = (1.0 - smoothstep(0.3, 1.1, across)) * along * 0.85;

  float alpha = max(max(line, tick), glow) * opacity * lock;
  if (alpha < 0.002) discard;
  gl_FragColor = vec4(color, alpha);
}
