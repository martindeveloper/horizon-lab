// Planetesimal surface: multi-scale impact craters with raised rims, continuous
// 3D regolith relief, and Lommel-Seeliger / Minnaert airless photometry in
// linear light, encoded to output sRGB.

varying vec3 vNormal;
varying vec3 vWorld;
varying vec3 vBody;
varying vec3 vColor;
varying float vSeed;
varying float vDetail;

#include <horizon/seeded-hash>
#include <horizon/fresnel>

// Smooth 3D value noise with exact analytical gradient: vec4(grad.xyz, value).
vec4 valueGrad3(vec3 p, float s) {
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

// 3D cellular impact crater layer: returns vec4(worldGrad.xyz, height).
vec4 craterLayer(vec3 u, float freq, vec3 shift, float s) {
  vec3 p = u * freq + shift;
  vec3 i = floor(p);
  vec3 f = fract(p);

  vec3 center = vec3(
    0.26 + 0.48 * seededHash3(i, s),
    0.26 + 0.48 * seededHash3(i + vec3(17.0, 5.0, 11.0), s),
    0.26 + 0.48 * seededHash3(i + vec3(7.0, 23.0, 3.0), s)
  );
  float rad = 0.22 + 0.14 * seededHash3(i + vec3(3.0, 13.0, 19.0), s);
  vec3 d = f - center;
  float r = sqrt(dot(d, d) + 1e-5);
  float x = r / rad;

  // Parabolic bowl floor (x < 0.84) surrounded by a raised annular ejecta rim.
  float tBowl = clamp(1.0 - (x * x) / 0.71, 0.0, 1.0);
  float hBowl = -0.75 * tBowl * tBowl;
  float dBowl = 3.0 * tBowl * (x / 0.71);

  float rimX = (x - 0.84) / 0.3;
  float tRim = clamp(1.0 - rimX * rimX, 0.0, 1.0);
  float hRim = 0.28 * tRim * tRim;
  float dRim = -1.12 * tRim * (rimX / 0.3);

  float dhdx = dBowl + dRim;
  vec3 grad = d * (dhdx * freq / (rad * r));
  return vec4(grad, hBowl + hRim);
}

void main() {
  vec3 n0 = normalize(vNormal);
  vec3 u = normalize(vBody);
  vec3 sunDir = normalize(-vWorld);
  vec3 viewDir = normalize(cameraPosition - vWorld);

  // Primary basins and macro regolith relief always evaluate; finer octaves only run when zoomed in.
  vec3 seedShift = vec3(vSeed * 19.0, fract(vSeed * 3.7) * 23.0, fract(vSeed * 7.9) * 17.0);
  vec4 c1 = craterLayer(u, 2.5, seedShift, vSeed);
  vec4 r1 = valueGrad3(u * 3.4 + seedShift, vSeed + 7.0);

  float craterH = c1.w * 0.55;
  float mottle = 0.84 + 0.32 * r1.w;
  vec3 grad = c1.xyz * 0.11 + r1.xyz * 0.045;

  if (vDetail > 0.02) {
    float midLod = smoothstep(0.02, 0.35, vDetail);
    vec4 c2 = craterLayer(u, 5.2, seedShift + vec3(0.47, 0.61, 0.33), vSeed + 2.0);
    vec4 r2 = valueGrad3(u * 8.2 - seedShift * 0.7, vSeed + 11.0);
    craterH += c2.w * (0.32 * midLod);
    mottle += 0.16 * (r2.w - 0.5) * midLod;
    grad += (c2.xyz * 0.055 + r2.xyz * 0.022) * midLod;

    if (vDetail > 0.35) {
      float fineLod = smoothstep(0.35, 0.85, vDetail);
      vec4 c3 = craterLayer(u, 10.5, seedShift + vec3(0.23, 0.79, 0.53), vSeed + 5.0);
      vec4 r3 = valueGrad3(u * 18.0 + seedShift * 1.3, vSeed + 17.0);
      craterH += c3.w * (0.16 * fineLod);
      mottle += 0.09 * (r3.w - 0.5) * fineLod;
      grad += (c3.xyz * 0.024 + r3.xyz * 0.01) * fineLod;
    }
  }

  vec3 tangentGrad = grad - n0 * dot(n0, grad);
  vec3 n = normalize(n0 - tangentGrad);

  // Airless regolith photometry: Lommel-Seeliger backscatter + algebraic Minnaert (k ≈ 0.58).
  float ndl = dot(n, sunDir);
  float ndl0 = dot(n0, sunDir);
  float mu0 = clamp((ndl + 0.07) / 1.07, 0.0, 1.0);
  float mu = max(dot(n, viewDir), 0.1);
  float lommel = (2.0 * mu0) / max(mu0 + mu, 0.15);
  float minnaert = sqrt(mu0) * min(inversesqrt(mu), 1.9) * (0.92 + 0.08 * mu0);
  float phaseCos = clamp(dot(sunDir, viewDir), 0.0, 1.0);
  float phase2 = phaseCos * phaseCos;
  float opposition = 1.0 + 0.18 * phase2 * phase2 * phase2;
  float macroMask = smoothstep(-0.18, 0.12, ndl0);
  float diffuse = mix(minnaert, lommel, 0.45) * opposition * macroMask;

  // Regolith albedo: dark space-weathered matrix, ponded crater floors, brighter fresh rims.
  float ejecta = clamp(craterH * 0.65 + length(tangentGrad) * 0.35, -0.22, 0.28);
  float ao = clamp(1.0 + min(craterH, 0.0) * 0.45, 0.62, 1.0);
  vec3 freshTint = mix(vColor, vec3(0.86, 0.84, 0.8), 0.25);
  vec3 baseCol = mix(vColor, freshTint, clamp(ejecta * 2.2, 0.0, 1.0)) * mottle * ao;

  float ambient = 0.036;
  vec3 col = baseCol * (ambient + (1.0 - ambient) * diffuse);

  // Subtle grazing rim on the sunlit limb only.
  float rim = fresnelRim(n, viewDir, 3.2) * clamp(ndl0 + 0.25, 0.0, 1.0);
  col += baseCol * rim * 0.16;

  gl_FragColor = linearToOutputTexel(vec4(col, 1.0));
}
