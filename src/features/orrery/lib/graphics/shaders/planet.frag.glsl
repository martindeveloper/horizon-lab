// Planet surface: a painted map lit by the Sun at the origin, in linear light.
// Minnaert's law I = μ₀ᵏ μᵏ⁻¹ sets the limb: k = 1 is Lambert (cloudy giants),
// k ≈ 0.6 the flat-looking disc of airless regolith. A narrow wrap softens the
// terminator; Earth adds an ocean glint, hazy bodies a Fresnel rim, and Saturn
// the shadow of its rings.

uniform sampler2D map;       // surface colour (sRGB texture, read as linear)
uniform vec3 atmos;          // haze tint at the limb
uniform float atmosStrength; // 0 = airless body
uniform float ambient;       // linear floor so the night side is not pure black
uniform float minnaert;      // limb-darkening exponent k
uniform float specStrength;  // ocean glint
uniform float specPower;     // glint tightness

#ifdef RING_SHADOW
uniform sampler2D ringMap;   // radial strip, alpha = normal opacity 1 − e^(−τ)
uniform vec3 ringPole;       // ring-plane normal, world
uniform float ringRadius;    // equatorial radius, world units
uniform vec2 ringSpan;       // inner and outer edge, equatorial radii
#endif

varying vec3 vNormal;
varying vec3 vWorld;
varying vec3 vView;
varying vec3 vOffset;
varying vec2 vUv;

#include <horizon/fresnel>
#include "./parameters.generated.glsl"

void main() {
  vec3 n = normalize(vNormal);
  vec3 sunDir = normalize(-vWorld);
  vec3 viewDir = normalize(vView);
  float ndl = dot(n, sunDir);
  float mu0 = clamp((ndl + PLANET_WRAP) / (1.0 + PLANET_WRAP), 0.0, 1.0);
  float mu = max(dot(n, viewDir), 0.1);
  float diffuse = pow(mu0, minnaert) * min(pow(mu, minnaert - 1.0), 2.0);

#ifdef RING_SHADOW
  // Follow the ray toward the Sun to the ring plane; the ring there dims it by e^(−τ/μ₀).
  float across = dot(sunDir, ringPole);
  float t = -dot(vOffset, ringPole) / (abs(across) > 1e-4 ? across : 1e-4);
  float r = length(vOffset + sunDir * t) / ringRadius;
  float s = (r - ringSpan.x) / (ringSpan.y - ringSpan.x);
  float opacity = texture2D(ringMap, vec2(clamp(s, 0.0, 1.0), 0.5)).a;
  float inRing = step(0.0, t) * step(0.0, s) * step(s, 1.0);
  float tau = -log(max(1.0 - opacity, 0.005));
  diffuse *= mix(1.0, exp(-tau / max(abs(across), 0.02)), inRing);
#endif

  vec3 col = texture2D(map, vUv).rgb * (ambient + (1.0 - ambient) * diffuse);

  // Specular glint, only on the day side of bodies with specular reflection.
  if (specStrength > 0.0 && ndl > 0.0) {
    vec3 halfV = normalize(sunDir + viewDir);
    col += pow(max(dot(n, halfV), 0.0), specPower) * specStrength * ndl;
  }

  // Haze: Fresnel rim, brighter where the Sun lights the limb.
  if (atmosStrength > 0.0) {
    float fresnel = fresnelRim(n, viewDir, 2.35);
    col += atmos * fresnel * atmosStrength * (0.15 + 0.85 * mu0);
  }

  gl_FragColor = linearToOutputTexel(vec4(col, 1.0));
}
