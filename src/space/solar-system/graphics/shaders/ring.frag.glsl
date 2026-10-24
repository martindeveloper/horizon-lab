// Planetary rings as a classical many-particle layer (single scattering,
// Chandrasekhar 1960; Cuzzi et al. 1984): a radial strip gives each radius its
// particle colour and normal opacity 1 − e^(−τ). The lit face reflects, the
// unlit face only transmits, so the dense B ring goes dark from behind while
// the thin C ring and Cassini Division glow. The planet's oblate shadow falls
// across them. Micrometre dust scatters forward, so Neptune's dusty rings,
// faint from the sunlit side, brighten seen toward the Sun.

uniform sampler2D map;     // radial strip: linear rgb colour, a = normal opacity
uniform sampler2D dust;    // radial strip: r = fraction of the opacity in dust
uniform vec2 span;         // inner and outer edge, equatorial radii (the geometry's radii)
uniform vec3 pole;         // ring-plane normal, world
uniform float radius;      // planet's equatorial radius, world units
uniform float squash;      // equatorial over polar radius
uniform vec3 sunPos;       // the Sun, world; the origin unless a host moves it
uniform float formed;      // how much of the rings exists: 0 before their dated age, 1 within it

varying vec3 vNormal;
varying vec3 vWorld;
varying vec3 vView;
varying vec3 vOffset;
varying vec2 vUv;

#include "./parameters.generated.glsl"
#include <horizon/log-depth>

// Dust's phase function over an isotropic scatterer's (three Henyey–Greenstein
// lobes), at the cosine of the scattering angle.
float dustPhase(float cosTheta) {
  vec3 g = RING_DUST_HG_G;
  vec3 lobes = (1.0 - g * g) / pow(1.0 + g * g - 2.0 * g * cosTheta, vec3(1.5));
  return dot(RING_DUST_HG_W, lobes);
}

void main() {
  logDepthFragment();
  // RingGeometry maps the plane to uv across its outer diameter.
  float r = length(vUv - 0.5) * 2.0 * span.y;
  float s = (r - span.x) / (span.y - span.x);
  vec2 at = vec2(clamp(s, 0.0, 1.0), 0.5);
  vec4 tex = texture2D(map, at);
  float tau = -log(max(1.0 - tex.a * formed * step(0.0, s) * step(s, 1.0), 0.005));
  if (tau <= 0.0) discard;

  vec3 sunDir = normalize(sunPos - vWorld);
  vec3 viewDir = normalize(vView);
  float nl = dot(pole, sunDir);
  float nv = dot(pole, viewDir);
  float mu0 = max(abs(nl), 0.01);
  float mu = max(abs(nv), 0.01);
  float alpha = 1.0 - exp(-tau / mu);

  // Scattered light, normalised so an opaque ring seen and lit face-on gives 1.
  float scatter;
  if (nl * nv > 0.0) {
    scatter = 2.0 * mu0 / (mu + mu0) * (1.0 - exp(-tau * (1.0 / mu + 1.0 / mu0)));
  } else if (abs(mu - mu0) < 1e-3) {
    scatter = 2.0 * tau / mu0 * exp(-tau / mu0);
  } else {
    scatter = 2.0 * mu0 / (mu - mu0) * (exp(-tau / mu) - exp(-tau / mu0));
  }

  // The globe's shadow: squash the polar axis so the spheroid becomes a sphere,
  // then ask whether the ray toward the Sun meets it.
  vec3 d = vOffset;
  d += pole * dot(d, pole) * (squash - 1.0);
  vec3 toSun = sunDir + pole * nl * (squash - 1.0);
  float b = dot(d, toSun);
  float disc = b * b - dot(toSun, toSun) * (dot(d, d) - radius * radius);
  float lit = 1.0 - step(0.0, disc) * step(b, 0.0);

  // The dust's share of τ follows its phase function; the large particles' keep the law above.
  float phase = mix(1.0, dustPhase(dot(-sunDir, viewDir)), texture2D(dust, at).r);
  vec3 col = tex.rgb * (RING_AMBIENT + (1.0 - RING_AMBIENT) * min(scatter * lit / alpha, 2.0) * phase);
  // Premultiplied: what reaches the eye is the scattered light plus 1 − alpha of what lies behind.
#ifdef RING_EXPOSURE
  // A long exposure of a faint system (`ringExposure`), a photograph of its light against the
  // sky: the exposed light itself is encoded, not the particles' colour scaled by opacity.
  vec3 shown = linearToOutputTexel(vec4(col * alpha * RING_EXPOSURE, 1.0)).rgb;
#else
  vec3 shown = linearToOutputTexel(vec4(col, alpha)).rgb * alpha;
#endif
  if (max(alpha, max(shown.r, max(shown.g, shown.b))) < 0.004) discard;
  gl_FragColor = vec4(shown, alpha);
}
