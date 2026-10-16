// Swarm vertex shader: thousands of small bodies on real orbit shapes, moved
// on the GPU. Each point carries two sets of orbital elements (the start and
// the end of the clearing sketch); the shader interpolates them by `mig`,
// solves Kepler's equation for the moment and rotates the perifocal position
// into the scene frame, exactly as the toolkit's keplerPosition does.
//
// Scene frame: X = ecliptic x, Y = ecliptic z (up), Z = −ecliptic y.

attribute vec4 orbitA; // a0, a1 (AU), e0, e1
attribute vec4 orbitB; // i0, i1, Ω (node), ω (argument of perihelion), radians
attribute vec4 orbitC; // M0 (radians), appears-at mig, co-orbital sign, co-orbital offset (radians)

uniform float mig;       // clearing progress 0–1
uniform float drift;     // model years of along-orbit motion
uniform float anchorLon; // mean longitude of the body co-orbitals follow (radians)
uniform float size;      // point size in pixels
uniform float dpr;       // device pixel ratio
uniform float near;      // points closer to the camera than this shrink away (AU)

varying vec3 vColor;
varying float vAlpha;

#include <horizon/math>
#include "./parameters.generated.glsl"

void main() {
  // Elements at this moment. Semi-major axes interpolate in log space.
  float a = exp(mix(log(orbitA.x), log(orbitA.y), mig));
  float e = mix(orbitA.z, orbitA.w, mig);
  float inc = mix(orbitB.x, orbitB.y, mig);
  float node = orbitB.z;
  float omega = orbitB.w;

  // Mean anomaly: Kepler's third law in years, or locked to the anchor body
  // for co-orbital Trojans (L = Ω + ω + M).
  float meanMotion = TWO_PI / pow(a, 1.5);
  float M = orbitC.x + meanMotion * drift;
  if (orbitC.z != 0.0) {
    M = anchorLon + orbitC.z * SWARM_TROJAN_OFFSET + orbitC.w - node - omega;
  }

  // Kepler's equation E − e sin E = M, a few Newton steps from E = M + e sin M.
  float E = M + e * sin(M);
  for (int k = 0; k < SWARM_KEPLER_STEPS; k++) {
    E -= (E - e * sin(E) - M) / (1.0 - e * cos(E));
  }

  // Perifocal position, then the classical rotation (ω, i, Ω) into the ecliptic.
  float xp = a * (cos(E) - e);
  float yp = a * sqrt(1.0 - e * e) * sin(E);
  float cw = cos(omega);
  float sw = sin(omega);
  float cn = cos(node);
  float sn = sin(node);
  float ci = cos(inc);
  float si = sin(inc);
  float x = (cw * cn - sw * sn * ci) * xp + (-sw * cn - cw * sn * ci) * yp;
  float y = (cw * sn + sw * cn * ci) * xp + (-sw * sn + cw * cn * ci) * yp;
  float z = sw * si * xp + cw * si * yp;
  vec3 pos = vec3(x, z, -y);

  vec4 mv = modelViewMatrix * vec4(pos, 1.0);

  // Bodies fade in as the clearing reaches their "appears" progress, and
  // shrink away when they would fly through the camera.
  float appear = orbitC.y <= 0.0 ? 1.0 : smoothstep(orbitC.y, orbitC.y + 0.12, mig);
  float camDist = length(mv.xyz);
  float close = smoothstep(near * 0.25, near, camDist);

  vColor = color;
  vAlpha = appear * close;

  gl_Position = projectionMatrix * mv;
  gl_PointSize = size * dpr * (0.75 + 0.25 * appear);
}
