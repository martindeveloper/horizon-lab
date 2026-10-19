// Edge-adaptive supersampling for full-screen ray shaders.
//
// The entry shader defines
//   vec3 shade(vec2 fragCoord, bool derivatives)
// returning the display-ready colour of one ray through fragCoord (in pixels),
// and includes this file last instead of writing main(). createFullscreenPass
// with `supersample: true` compiles the shader twice:
//   HORIZON_PASS 0  one ray per pixel (the default, and the only pass otherwise);
//   HORIZON_PASS 1  reads that frame and, only where a pixel's luma differs from
//                   a neighbour's by SUPERSAMPLE_EDGE or more, traces four more
//                   rays on a rotated grid and averages all five.
// Smooth regions cost one texture read; edges and features thinner than a pixel,
// which single rays hit or miss, get resolved instead of filtered. The extra rays
// run in non-uniform control flow, so they receive derivatives = false and must
// not rely on dFdx, dFdy or fwidth.

#ifndef HORIZON_PASS
#define HORIZON_PASS 0
#endif

#ifndef SUPERSAMPLE_EDGE
#define SUPERSAMPLE_EDGE 0.04
#endif

#if HORIZON_PASS == 1

uniform sampler2D uFirstPass;
uniform vec2 uFirstTexel;

float supersampleLuma(vec2 uv) {
  return dot(texture2D(uFirstPass, uv).rgb, vec3(0.299, 0.587, 0.114));
}

// Rotated-grid offsets in pixels: four rays, each in its own quarter of the pixel
// and on its own row and column.
vec2 supersampleOffset(int i) {
  if (i == 0) return vec2(0.125, 0.375);
  if (i == 1) return vec2(-0.375, 0.125);
  if (i == 2) return vec2(-0.125, -0.375);
  return vec2(0.375, -0.125);
}

void main() {
  vec2 uv = gl_FragCoord.xy * uFirstTexel;
  vec3 first = texture2D(uFirstPass, uv).rgb;
  float luma = dot(first, vec3(0.299, 0.587, 0.114));
  float lo = luma;
  float hi = luma;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      float l = supersampleLuma(uv + vec2(float(x), float(y)) * uFirstTexel);
      lo = min(lo, l);
      hi = max(hi, l);
    }
  }
  if (hi - lo < SUPERSAMPLE_EDGE) {
    gl_FragColor = vec4(first, 1.0);
    return;
  }
  vec3 sum = first;
  for (int i = 0; i < 4; i++) sum += shade(gl_FragCoord.xy + supersampleOffset(i), false);
  gl_FragColor = vec4(sum / 5.0, 1.0);
}

#else

void main() {
  gl_FragColor = vec4(shade(gl_FragCoord.xy, true), 1.0);
}

#endif
