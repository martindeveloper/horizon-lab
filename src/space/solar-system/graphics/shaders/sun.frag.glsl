// Near-white HMI intensity with limb darkening and a slight warm edge. The
// display coefficients preserve the measured fits' luminance, reducing their
// narrow-band chroma at build time. Source limb shading is removed from the map.

uniform sampler2D map; // sRGB-encoded, quiet-normalized HMI intensity

varying vec3 vNormal;
varying vec3 vView;
varying vec2 vUv;

#include "./parameters.generated.glsl"
#include <horizon/log-depth>

void main() {
  logDepthFragment();
  vec3 n = normalize(vNormal);
  vec3 viewDir = normalize(vView);

  float mu = clamp(dot(n, viewDir), 0.0, 1.0);
  vec3 limb = 1.0 - SUN_DISPLAY_LIMB_U * (1.0 - mu) - SUN_DISPLAY_LIMB_V * (1.0 - mu * mu);
  float intensity = texture2D(map, vUv).r / SUN_MAP_QUIET_INTENSITY;

  vec3 col = SUN_CENTRE_RGB * limb * intensity;
  gl_FragColor = linearToOutputTexel(vec4(col, 1.0));
}
