// The Sun: self-lit, with measured limb darkening per colour channel, so the
// limb is darker and redder than the white centre, over a faint
// supergranulation map. The glow sprites around it add the halo.

uniform sampler2D map; // grey granulation noise, mean ~0.86

varying vec3 vNormal;
varying vec3 vView;
varying vec2 vUv;

#include "./parameters.generated.glsl"

void main() {
  vec3 n = normalize(vNormal);
  vec3 viewDir = normalize(vView);

  float mu = clamp(dot(n, viewDir), 0.0, 1.0);
  vec3 limb = 1.0 - SUN_LIMB_U * (1.0 - mu) - SUN_LIMB_V * (1.0 - mu * mu);
  float grain = texture2D(map, vUv).r;

  vec3 col = SUN_CENTRE_RGB * limb * (0.5 + 0.58 * grain);
  gl_FragColor = linearToOutputTexel(vec4(col, 1.0));
}
