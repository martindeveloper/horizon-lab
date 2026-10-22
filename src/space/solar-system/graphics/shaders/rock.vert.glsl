// Planetesimals: the sample of the disk's leftovers (model/tracers.ts), instanced 3D
// small bodies lit by the Sun at the origin and moved on the GPU. Each instance
// carries its elements before and after the clearing and its track through it
// (graphics/tracers.ts); the shader follows the track to the moment exactly as
// tracerElements does, places the body `drift` years on from its phase at the drift
// epoch (drift-epoch.ts), and hides it once it is gone or while its bin is switched off. The bin's colour tints it.
// Its `seed` orientates its principal axes and shapes the unit sphere into a smooth
// triaxial, lobed rubble-pile figure with single-pass analytical surface normals;
// `radius` sizes them all, so a zoom changes one uniform instead of every instance.

#include "./parameters.generated.glsl"

attribute vec4 orbitA; // a0, a1 (AU), e0, e1
attribute vec4 orbitB; // i0, i1, Ω (node), ω (argument of perihelion), radians
attribute vec4 orbitC; // phase M at the drift epoch (radians), the clearing's progress p0 and p1 its scattering spans, seed
attribute vec3 track;  // s by which a reaches a1, s from which i leaves i0, pumped e (1) or not (0)
attribute vec3 stages; // its stages: a bin's index, or TRACER_BINS once gone
attribute vec2 steps;  // the s at which the second and the third stage begin

uniform float mig;    // clearing progress 0–1
uniform float drift;  // model years along the orbits since the drift epoch
uniform float radius; // world radius of a shown body
uniform vec3 binColor[TRACER_BINS];
uniform float binShown[TRACER_BINS]; // 1 while the bin's switch is on

varying vec3 vNormal;
varying vec3 vWorld;
varying vec3 vBody;
varying vec3 vColor;
varying float vSeed;
varying float vDetail;

#include <horizon/math>
#include <horizon/seeded-hash>
#include "./kepler.glsl"

// Smooth C1 trilinear value noise with exact analytical gradient: vec4(grad.xyz, value).
vec4 smoothValue3(vec3 p, float s) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);
  vec3 du = 6.0 * f * (1.0 - f);

  float c000 = seededHash3(i, s);
  float c100 = seededHash3(i + vec3(1.0, 0.0, 0.0), s);
  float c010 = seededHash3(i + vec3(0.0, 1.0, 0.0), s);
  float c110 = seededHash3(i + vec3(1.0, 1.0, 0.0), s);
  float c001 = seededHash3(i + vec3(0.0, 0.0, 1.0), s);
  float c101 = seededHash3(i + vec3(1.0, 0.0, 1.0), s);
  float c011 = seededHash3(i + vec3(0.0, 1.0, 1.0), s);
  float c111 = seededHash3(i + vec3(1.0, 1.0, 1.0), s);

  float k0 = c000;
  float k1 = c100 - c000;
  float k2 = c010 - c000;
  float k3 = c001 - c000;
  float k4 = c000 - c100 - c010 + c110;
  float k5 = c000 - c010 - c001 + c011;
  float k6 = c000 - c100 - c001 + c101;
  float k7 = -c000 + c100 + c010 - c110 + c001 - c101 - c011 + c111;

  float val = k0 + k1 * u.x + k2 * u.y + k3 * u.z + k4 * u.x * u.y + k5 * u.y * u.z +
              k6 * u.z * u.x + k7 * u.x * u.y * u.z;
  vec3 grad = du * vec3(
    k1 + k4 * u.y + k6 * u.z + k7 * u.y * u.z,
    k2 + k4 * u.x + k5 * u.z + k7 * u.x * u.z,
    k3 + k5 * u.y + k6 * u.x + k7 * u.x * u.y
  );
  return vec4(grad, val);
}

// Smooth triaxial + low-order harmonic figure with analytical gradient in body space.
vec4 rockShape(vec3 u, vec3 ax, vec3 ay, vec3 az, float s) {
  vec3 q = vec3(dot(u, ax), dot(u, ay), dot(u, az));

  float elong = 0.14 + 0.14 * fract(s * 3.7);
  float flatAxis = 0.08 + 0.1 * fract(s * 5.3);
  float asym = (fract(s * 11.1) - 0.5) * 0.18;
  float basinAmp = (fract(s * 17.3) - 0.5) * 0.09;

  // Quadrupole (l = 2), octupole (l = 3), and hexadecapole (l = 4) modes + analytical q-gradient.
  float y20 = q.x * q.x - 0.5 * (q.y * q.y + q.z * q.z);
  float y22 = q.y * q.y - q.z * q.z;
  float y30 = q.x * (q.x * q.x - 0.6);
  float y32 = q.x * q.y * q.z;
  float y42 = (q.x * q.x - q.y * q.y) * (q.z * q.z - 0.25);

  vec4 lobe = smoothValue3(q * 1.8 + s * 4.3, s);
  float r = 1.0 + elong * y20 - flatAxis * y22 + asym * y30 + 0.14 * y32 +
            basinAmp * y42 + (lobe.w - 0.5) * 0.26;

  vec3 dQ = elong * vec3(2.0 * q.x, -q.y, -q.z)
          - flatAxis * vec3(0.0, 2.0 * q.y, -2.0 * q.z)
          + asym * vec3(3.0 * q.x * q.x - 0.6, 0.0, 0.0)
          + 0.14 * vec3(q.y * q.z, q.x * q.z, q.x * q.y)
          + basinAmp * vec3(
              2.0 * q.x * (q.z * q.z - 0.25),
              -2.0 * q.y * (q.z * q.z - 0.25),
              2.0 * q.z * (q.x * q.x - q.y * q.y)
            )
          + lobe.xyz * (1.8 * 0.26);

  vec3 gradU = ax * dQ.x + ay * dQ.y + az * dQ.z;
  return vec4(gradU, r);
}

void main() {
  // The body's own progress through the clearing (its spans are never empty), and the
  // stage it has reached.
  float s = smoothstep(orbitC.y, orbitC.z, mig);
  int bin = int(s < steps.x ? stages.x : s < steps.y ? stages.y : stages.z);

  // Cull gone and filtered planetesimals before any orbit or shape math.
  if (bin >= TRACER_BINS || binShown[bin] < 0.5) {
    vNormal = vec3(0.0, 1.0, 0.0);
    vWorld = vec3(0.0);
    vBody = vec3(0.0, 1.0, 0.0);
    vColor = vec3(0.0);
    vSeed = 0.0;
    vDetail = 0.0;
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }

  // Elements at this moment. Semi-major axes interpolate in log space; a pumped
  // eccentricity climbs with the perihelion held, then eases to its final value.
  float a = exp(mix(log(orbitA.x), log(orbitA.y), min(1.0, s / track.x)));
  float e = mix(orbitA.z, orbitA.w, s);
  if (track.z > 0.5) {
    float peak = clamp(
      1.0 - TRACER_PUMP_PERIHELION / max(a, TRACER_PUMP_FLOOR),
      orbitA.w,
      TRACER_PUMP_MAX_E
    );
    e = s < TRACER_PUMP_PEAK
      ? mix(orbitA.z, peak, s / TRACER_PUMP_PEAK)
      : mix(peak, orbitA.w, (s - TRACER_PUMP_PEAK) / (1.0 - TRACER_PUMP_PEAK));
  }
  float inc = mix(orbitB.x, orbitB.y, clamp((s - track.y) / (1.0 - track.y), 0.0, 1.0));
  // Mean anomaly by Kepler's third law in years, as the swarms move.
  float M = orbitC.x + TWO_PI / pow(a, 1.5) * drift;
  vec3 pos = keplerPosition(a, e, inc, orbitB.z, orbitB.w, M, TRACER_KEPLER_STEPS);

  mat4 model = modelMatrix * mat4(
    vec4(radius, 0.0, 0.0, 0.0),
    vec4(0.0, radius, 0.0, 0.0),
    vec4(0.0, 0.0, radius, 0.0),
    vec4(pos, 1.0)
  );
  float worldRadius = length(model[0].xyz);

  vSeed = orbitC.w;
  vec3 u = normalize(position);
  vBody = u;

  // Per-instance principal axes so every asteroid has its own 3D orientation.
  float phi = vSeed * TWO_PI;
  float cosT = fract(vSeed * 7.3) * 2.0 - 1.0;
  float sinT = sqrt(max(0.0, 1.0 - cosT * cosT));
  vec3 ax = vec3(sinT * cos(phi), cosT, sinT * sin(phi));
  vec3 ref = abs(ax.y) < 0.85 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
  vec3 ay = normalize(cross(ref, ax));
  vec3 az = cross(ax, ay);

  vec4 shape = rockShape(u, ax, ay, az, vSeed);
  vec3 p = u * shape.w;
  vec3 tangentGrad = shape.xyz - u * dot(u, shape.xyz);
  vec3 nLocal = normalize(u - tangentGrad / shape.w);

  vec4 world = model * vec4(p, 1.0);
  vWorld = world.xyz;
  vNormal = normalize(mat3(model) * nLocal);

  float angularSize = worldRadius / max(length(cameraPosition - world.xyz), 1e-6);
  vDetail = clamp((angularSize - 0.004) * 28.0, 0.0, 1.0);

  vColor = binColor[bin];

  gl_Position = projectionMatrix * viewMatrix * world;
}
