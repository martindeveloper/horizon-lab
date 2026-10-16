// Planetesimal surface: the instance tint, grained by a hash and lit by the
// Sun at the origin with a hard terminator and a thin rim.

varying vec3 vNormal;
varying vec3 vWorld;
varying vec3 vColor;
varying float vSeed;

#include <horizon/seeded-hash>

#include <horizon/fresnel>

void main() {
  vec3 n = normalize(vNormal);
  vec3 sunDir = normalize(-vWorld);
  vec3 viewDir = normalize(cameraPosition - vWorld);
  float ndl = dot(n, sunDir);

  // Airless body: a sharp terminator and a low night-side floor.
  float day = clamp(ndl * 0.85 + 0.15, 0.0, 1.0);
  float light = 0.2 + 0.8 * day * day;

  // Surface grain, five cells across the body.
  float grain = 0.78 + 0.44 * seededHash3(floor(n * 5.0), vSeed);
  vec3 col = vColor * grain * light;

  // Rim light on the sunlit limb only.
  float rim = fresnelRim(n, viewDir, 3.0) * clamp(ndl + 0.3, 0.0, 1.0);
  col += vColor * rim * 0.25;

  gl_FragColor = vec4(col, 1.0);
}
