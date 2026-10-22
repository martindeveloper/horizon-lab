// A spacecraft's surface lit by the Sun as a distant light, in linear light. Paint and the
// dishes scatter as matte surfaces; metal (foil, brass) reflects the Sun in its glint and
// scatters a share of its colour (`SPACECRAFT_FOIL_SCATTER`), its crinkles from the model's
// normal map. The glint is normalised Blinn–Phong at the GGX-equivalent exponent, with
// Schlick's Fresnel. Thin parts light from either side. `presence` fades the craft in.

uniform sampler2D map;    // base colour (sRGB texture, read as linear); a white texel if none
uniform vec3 color;       // multiplies the map
uniform float metalness;
uniform float roughness;
uniform vec3 sunDir;      // world, unit: toward the Sun
uniform float presence;   // 0..1
#ifdef USE_NORMAL_MAP
uniform sampler2D normalMap; // tangent space, as glTF has it
uniform vec2 normalScale;
#endif
#ifdef DISPLAY_GAMUT
uniform mat3 uGamut;      // linear sRGB to the canvas's primaries
#endif

varying vec3 vNormal;
varying vec3 vView;
varying vec2 vUv;

#include "./parameters.generated.glsl"
#include <horizon/display>
#include <horizon/log-depth>

#ifdef USE_NORMAL_MAP
// The tangent frame from screen derivatives of the position and the texture coordinate, as
// three.js builds it for a mesh without tangents (Schüler 2013).
mat3 tangentFrame(vec3 position, vec3 n, vec2 uv) {
  vec3 q0 = dFdx(position);
  vec3 q1 = dFdy(position);
  vec2 st0 = dFdx(uv);
  vec2 st1 = dFdy(uv);
  vec3 q1perp = cross(q1, n);
  vec3 q0perp = cross(n, q0);
  vec3 t = q1perp * st0.x + q0perp * st1.x;
  vec3 b = q1perp * st0.y + q0perp * st1.y;
  float det = max(dot(t, t), dot(b, b));
  float scale = det == 0.0 ? 0.0 : inversesqrt(det);
  return mat3(t * scale, b * scale, n);
}
#endif

void main() {
  logDepthFragment();
  vec3 n = normalize(vNormal);
  if (!gl_FrontFacing) n = -n;
#ifdef USE_NORMAL_MAP
  vec3 bump = texture2D(normalMap, vUv).xyz * 2.0 - 1.0;
  bump.xy *= normalScale;
  n = normalize(tangentFrame(-vView, n, vUv) * bump);
#endif
  vec3 v = normalize(vView);
  vec3 albedo = texture2D(map, vUv).rgb * color;
  float ndl = max(dot(n, sunDir), 0.0);
  vec3 matte = albedo * mix(1.0, SPACECRAFT_FOIL_SCATTER, metalness);
  vec3 col = matte * (SPACECRAFT_AMBIENT + (1.0 - SPACECRAFT_AMBIENT) * ndl);

  float alpha = max(roughness * roughness, SPACECRAFT_MIN_ALPHA);
  float power = 2.0 / (alpha * alpha) - 2.0;
  vec3 h = normalize(sunDir + v);
  vec3 f0 = mix(vec3(SPACECRAFT_DIELECTRIC_F0), albedo, metalness);
  vec3 fresnel = f0 + (1.0 - f0) * pow(1.0 - max(dot(h, v), 0.0), 5.0);
  col += fresnel * (power + 8.0) / 8.0 * pow(max(dot(n, h), 0.0), power) * ndl;

#ifdef DISPLAY_GAMUT
  gl_FragColor = vec4(displayEncode(uGamut * col), presence);
#else
  gl_FragColor = linearToOutputTexel(vec4(col, presence));
#endif
}
