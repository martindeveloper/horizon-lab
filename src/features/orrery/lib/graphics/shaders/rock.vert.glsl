// Planetesimals: instanced lumps lit by the Sun at the origin. Each instance's
// `seed` attribute dents the unit sphere into its own potato shape; the
// instance colour carries the population tint (Kuiper belt, scattered disk…).

attribute float seed;

varying vec3 vNormal;
varying vec3 vWorld;
varying vec3 vColor;
varying float vSeed;

// Cheap per-instance hash; the seed keeps every rock's shape different.
#include <horizon/seeded-hash>

void main() {
  vSeed = seed;

  // Two octaves of radial bumps: broad lumps and finer dents.
  float lump = (seededHash3(floor(position * 2.2 + 0.5), vSeed) - 0.5) * 0.42;
  float dent = (seededHash3(floor(position * 4.5 + 0.5), vSeed) - 0.5) * 0.16;
  vec3 p = position * (1.0 + lump + dent);

  mat4 model = modelMatrix;
  #ifdef USE_INSTANCING
    model = modelMatrix * instanceMatrix;
  #endif

  vec4 world = model * vec4(p, 1.0);
  vWorld = world.xyz;

  // Tilt the sphere normal toward the bumped surface; exact normals are not worth the cost.
  vNormal = normalize(mat3(model) * normalize(position + (p - position) * 0.6));

  vColor = vec3(1.0);
  #ifdef USE_INSTANCING_COLOR
    vColor = instanceColor;
  #endif

  gl_Position = projectionMatrix * viewMatrix * world;
}
