// Planetesimals: instanced 3D small bodies lit by the Sun at the origin. Each
// instance's `seed` attribute orientates its principal axes and shapes the unit
// sphere into a smooth triaxial, lobed rubble-pile figure with single-pass
// analytical surface normals; the instance colour carries the population tint.

attribute float seed;

varying vec3 vNormal;
varying vec3 vWorld;
varying vec3 vBody;
varying vec3 vColor;
varying float vSeed;
varying float vDetail;

#include <horizon/math>
#include <horizon/seeded-hash>

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
  mat4 model = modelMatrix;
  #ifdef USE_INSTANCING
    model = modelMatrix * instanceMatrix;
  #endif

  // Cull hidden/filtered planetesimal instances (scale = 0) before any shape math.
  float worldRadius = length(model[0].xyz);
  if (worldRadius <= 0.0) {
    vNormal = vec3(0.0, 1.0, 0.0);
    vWorld = vec3(0.0);
    vBody = vec3(0.0, 1.0, 0.0);
    vColor = vec3(0.0);
    vSeed = 0.0;
    vDetail = 0.0;
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }

  vSeed = seed;
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

  vColor = vec3(1.0);
  #ifdef USE_INSTANCING_COLOR
    vColor = instanceColor;
  #endif

  gl_Position = projectionMatrix * viewMatrix * world;
}
