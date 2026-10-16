// Round point-sprite glow: a Gaussian that reaches zero at the sprite edge.
// Pass gl_PointCoord; larger falloff gives a tighter core.
float pointGlow(vec2 pointCoord, float falloff) {
  vec2 d = pointCoord - 0.5;
  float r2 = dot(d, d) * 4.0;
  return exp(-r2 * falloff) * step(r2, 1.0);
}
