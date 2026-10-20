// A diffraction star (the lens pass), in one draw: the destination is the size of the bright
// mask it reads (uImage, a level of the bloom chain, one pixel = uTexel), and each of its
// pixels sums the mask along every arm (HORIZON_LENS_ARMS directions, each running both
// ways: two for a four-point star, three for six), HORIZON_LENS_TAPS bilinear taps out each
// way, a tap uSteps[arm] apart, each weighted by the square of its remaining share of the
// arm, so a spike tapers to nothing at its end. Both counts are compile-time, so the loops
// unroll. The weights of one way are normalised (uNorm), so a light as long as an arm spikes
// as bright as itself and a point a quarter as bright, fading out. Only bright light spikes:
// a tap counts in proportion to the square of its brightness (the brightest channel) over
// the threshold (uInvThreshold is its reciprocal), in full from there, so a hot disc or the
// brightest star gets a star and a faint one none.

#ifndef HORIZON_LENS_ARMS
#define HORIZON_LENS_ARMS 2
#endif
#ifndef HORIZON_LENS_TAPS
#define HORIZON_LENS_TAPS 10
#endif

uniform sampler2D uImage;
uniform vec2 uTexel;
uniform vec2 uSteps[HORIZON_LENS_ARMS];
uniform float uNorm;
uniform float uInvThreshold;

vec3 tap(vec2 uv) {
  vec3 m = texture2D(uImage, uv).rgb;
  float gate = min(max(m.r, max(m.g, m.b)) * uInvThreshold, 1.0);
  return m * gate * gate;
}

void main() {
  vec2 uv = gl_FragCoord.xy * uTexel;
  vec3 sum = vec3(0.0);
  for (int a = 0; a < HORIZON_LENS_ARMS; a++) {
    vec2 along = uSteps[a];
    for (int i = 1; i <= HORIZON_LENS_TAPS; i++) {
      float w = 1.0 - float(i) / float(HORIZON_LENS_TAPS + 1);
      vec2 d = float(i) * along;
      sum += (tap(uv + d) + tap(uv - d)) * (w * w);
    }
  }
  gl_FragColor = vec4(sum * uNorm, 1.0);
}
