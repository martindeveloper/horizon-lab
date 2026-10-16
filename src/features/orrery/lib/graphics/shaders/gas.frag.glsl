// The young gas disk around the forming Sun. The painted map carries colour
// and clumps; the inner cavity and the outer rim are computed per pixel so no
// texel edge shows when the camera sits a few au from the Sun. GAS_CAVITY_IN/OUT
// (the dust-free zone where grains sublimate) and GAS_RIM_IN/OUT are fractions
// of the painted radius, from parameters.generated.glsl.

uniform sampler2D map; // colour and alpha of the disk
uniform float opacity; // fades to zero as the gas disperses

varying vec2 vUv;

#include "./parameters.generated.glsl"

void main() {
  vec4 tex = texture2D(map, vUv);

  // Radius from the centre, 1.0 at the edge of the painted disk.
  float r = length(vUv - 0.5) * 2.0;
  float cavity = smoothstep(GAS_CAVITY_IN, GAS_CAVITY_OUT, r);
  float rim = 1.0 - smoothstep(GAS_RIM_IN, GAS_RIM_OUT, r);

  gl_FragColor = vec4(tex.rgb, tex.a * cavity * rim * opacity);
}
