// An orbit line as the ship sees it: each vertex, placed from the ship by the model matrix,
// is moved where a moving ship sees that point (aberration towards the direction of travel,
// the distance stretched by the Doppler factor, as seen.ts places the globes), so the lines
// stay on the bodies' seen orbits however fast the ship goes. At rest nothing moves.

uniform vec3 forward; // the ship's direction of travel, unit
uniform float beta;   // v / c
uniform float gamma;

#include <horizon/relativity>
#include <horizon/log-depth>

void main() {
  vec3 at = (modelMatrix * vec4(position, 1.0)).xyz;
  vec3 seen = at;
  float d = length(at);
  if (beta > 0.0 && d > 0.0) {
    vec3 n = at / d;
    float D = dopplerFactor(beta, gamma, dot(n, forward));
    seen = aberrate(n, forward, beta, gamma) * (d * D);
  }
  gl_Position = projectionMatrix * viewMatrix * vec4(seen, 1.0);
  logDepthVertex();
}
