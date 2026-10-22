// A small display-space focus aid, not physical depth of field. The expensive scene is
// rendered once. Only neighbouring bodies need the nine-tap filter; the focus and sky copy
// through. CSS-pixel offsets keep the softness consistent across DPR and quality settings.
#include "./parameters.generated.glsl"

uniform sampler2D uImage;
uniform vec2 uTexel;
uniform vec2 uResolution;
uniform float uPixelRatio;
uniform int uCount;
uniform vec4 uShape[MAX_DISCS];
uniform float uBlurRadius[MAX_DISCS];
uniform float uBaseline;
uniform vec3 uOrbitCentre;
uniform vec2 uOrbits[ORBIT_COUNT];

#include <horizon/srgb>

vec3 lightAt(vec2 uv) {
  return decodeSrgb(texture2D(uImage, uv).rgb);
}

void main() {
  vec2 uv = gl_FragCoord.xy * uTexel;
  vec2 p = vec2(gl_FragCoord.x, uResolution.y - gl_FragCoord.y) / uPixelRatio;
  float radius = 0.0;
  // Same back-to-front order as the scene. Conservative ellipse padding protects the
  // irregular supergiant limb, plus a full filter footprint outside the focused body.
  for (int i = 0; i < MAX_DISCS; i++) {
    if (i >= uCount) break;
    vec4 shape = uShape[i];
    vec2 axes = shape.zw * 1.04 + 4.0;
    float edge = (length((p - shape.xy) / axes) - 1.0) * min(axes.x, axes.y);
    float cover = 1.0 - smoothstep(0.0, 10.0, edge);
    radius = mix(radius, uBlurRadius[i], cover);
  }
  // Measurement overlays remain sharp, even where a ring crosses a neighbouring body.
  float lineDistance = abs(p.y - uBaseline);
  if (uOrbitCentre.z > 0.5) {
    float r = length(p - uOrbitCentre.xy);
    for (int k = 0; k < ORBIT_COUNT; k++) {
      if (uOrbits[k].y > 0.0)
        lineDistance = min(lineDistance, abs(r - uOrbits[k].x));
    }
  }
  radius *= smoothstep(3.0, 7.0, lineDistance);
  if (radius < 0.01) {
    gl_FragColor = texture2D(uImage, uv);
    return;
  }
  vec2 d = radius * uPixelRatio * uTexel;
  // Binomial kernel: unit energy and symmetric offsets preserve brightness and position.
  // Average decoded light to avoid a dark fringe around bright stellar silhouettes.
  vec3 light = 4.0 * lightAt(uv);
  light += 2.0 * (lightAt(uv + vec2(d.x, 0.0)) + lightAt(uv - vec2(d.x, 0.0))
               + lightAt(uv + vec2(0.0, d.y)) + lightAt(uv - vec2(0.0, d.y)));
  light += lightAt(uv + d) + lightAt(uv - d)
         + lightAt(uv + vec2(d.x, -d.y)) + lightAt(uv + vec2(-d.x, d.y));
  gl_FragColor = vec4(encodeSrgb(light / 16.0), 1.0);
}
