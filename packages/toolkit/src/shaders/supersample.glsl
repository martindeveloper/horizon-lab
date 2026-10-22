// Edge-adaptive supersampling for full-screen ray shaders.
//
// The entry shader defines
//   vec3 shade(vec2 fragCoord, bool derivatives)
// returning the radiance of one ray through fragCoord (in pixels), before any tone
// mapping, and
//   vec3 display(vec3 radiance, vec2 fragCoord)
// turning radiance into the display-ready colour of that pixel (vignette, exposure, tone
// map, dither), and includes this file last instead of writing main(). createFullscreenPass
// with `supersample: true` compiles the shader twice:
//   HORIZON_PASS 0  one ray per pixel (the default, and the only pass otherwise);
//   HORIZON_PASS 1  reads that frame and, only where a pixel's luma differs from
//                   a neighbour's by SUPERSAMPLE_EDGE or more, traces four more
//                   rays on a rotated grid and averages all five.
// Smooth regions cost one texture read; edges and features thinner than a pixel,
// which single rays hit or miss, get resolved instead of filtered. The extra rays
// run in non-uniform control flow, so they receive derivatives = false and must
// not rely on dFdx, dFdy or fwidth.
//
// uHdrOutput (set by createFullscreenPass) chooses what the frame holds: 0 writes display
// colours straight to the canvas; 1 writes radiance into a floating-point frame for a
// bloom chain and a resolve shader to finish. Edges are judged on display luma either
// way, so the same pixels get extra rays.
//
// A pass of the consumer's own that writes main() itself (a ray shader recording its march
// into targets of its own) defines HORIZON_CUSTOM_MAIN before this include, which then adds
// nothing.

#ifndef HORIZON_CUSTOM_MAIN

#ifndef HORIZON_PASS
#define HORIZON_PASS 0
#endif

#ifndef SUPERSAMPLE_EDGE
#define SUPERSAMPLE_EDGE 0.04
#endif

uniform float uHdrOutput;

vec3 supersampleOutput(vec3 radiance, vec2 fragCoord) {
  return uHdrOutput > 0.5 ? radiance : display(radiance, fragCoord);
}

#if HORIZON_PASS == 1

uniform sampler2D uFirstPass;
uniform vec2 uFirstTexel;

float supersampleLuma(vec2 uv, vec2 fragCoord) {
  vec3 c = texture2D(uFirstPass, uv).rgb;
  if (uHdrOutput > 0.5) c = display(c, fragCoord);
  return dot(c, vec3(0.299, 0.587, 0.114));
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
  float luma = supersampleLuma(uv, gl_FragCoord.xy);
  float lo = luma;
  float hi = luma;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 shift = vec2(float(x), float(y));
      float l = supersampleLuma(uv + shift * uFirstTexel, gl_FragCoord.xy + shift);
      lo = min(lo, l);
      hi = max(hi, l);
    }
  }
  if (hi - lo < SUPERSAMPLE_EDGE) {
    gl_FragColor = vec4(first, 1.0);
    return;
  }
  vec3 sum = first;
  for (int i = 0; i < 4; i++) {
    vec2 at = gl_FragCoord.xy + supersampleOffset(i);
    sum += supersampleOutput(shade(at, false), at);
  }
  gl_FragColor = vec4(sum / 5.0, 1.0);
}

#else

void main() {
  gl_FragColor = vec4(supersampleOutput(shade(gl_FragCoord.xy, true), gl_FragCoord.xy), 1.0);
}

#endif

#endif // HORIZON_CUSTOM_MAIN
