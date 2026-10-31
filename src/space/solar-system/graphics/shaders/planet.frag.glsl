// Planet surface: a painted map lit by the Sun at the origin, in linear light.
// Minnaert's law I = μ₀ᵏ μᵏ⁻¹ sets the limb: k = 1 is Lambert (cloudy giants),
// k ≈ 0.6 the flat-looking disc of airless regolith. A narrow wrap softens the
// terminator; Earth adds an ocean glint, hazy bodies a Fresnel rim, and Saturn
// the shadow of its rings. A new map fades in over what showed before (a streaming
// placeholder's flat colour, or a coarser map); a host may blend in a later surface.

uniform sampler2D map;       // surface colour (sRGB texture, read as linear)
uniform vec3 mapTint;        // multiplies the map: a placeholder is a white texel times its colour
uniform sampler2D prior;     // what the map is fading in over
uniform vec3 priorTint;
uniform float fade;          // 0 shows the prior, 1 the map
uniform sampler2D laterMap;  // a later surface: a host's model of how the body will look
uniform float later;         // 0 shows the map, 1 the later surface; 0 skips it
uniform vec3 atmos;          // haze tint at the limb
uniform float atmosStrength; // 0 = airless body
uniform float ambient;       // linear floor so the night side is not pure black
uniform float minnaert;      // limb-darkening exponent k
uniform float specStrength;  // ocean glint
uniform float specPower;     // glint tightness
uniform vec3 sunPos;         // the Sun, world; the origin unless a host moves it
uniform float sunRadius;     // the Sun's radius, world units; 0 lights from a point
uniform vec3 sunlight;       // the Sun's light on the surface, linear: white at today's strength unless a host writes it
uniform vec3 skylight;       // the sky's light on the night side's floor, linear: white unless a host writes it

#ifdef OCCLUDERS
// Bodies that may stand between this surface and the Sun: centre (world) and radius, world
// units; a radius of 0 is an empty slot. A host writes them per body each frame.
uniform vec4 occluders[OCCLUDERS];
#endif

#ifdef RING_SHADOW
uniform sampler2D ringMap;   // radial strip, alpha = normal opacity 1 − e^(−τ)
uniform vec3 ringPole;       // ring-plane normal, world
uniform float ringRadius;    // equatorial radius, world units
uniform float ringFormed;    // how much of the rings exists: 0 before their dated age, 1 within it
uniform vec2 ringSpan;       // inner and outer edge, equatorial radii
#endif

varying vec3 vNormal;
varying vec3 vWorld;
varying vec3 vView;
varying vec3 vOffset;
varying vec2 vUv;

#include <horizon/fresnel>
#include "./parameters.generated.glsl"
#include <horizon/log-depth>

void main() {
  logDepthFragment();
  vec3 n = normalize(vNormal);
  vec3 toSun = sunPos - vWorld;
  float sunDist = length(toSun);
  vec3 sunDir = toSun / sunDist;
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
  float opacity = texture2D(ringMap, vec2(clamp(s, 0.0, 1.0), 0.5)).a * ringFormed;
  float inRing = step(0.0, t) * step(0.0, s) * step(s, 1.0);
  float tau = -log(max(1.0 - opacity, 0.005));
  diffuse *= mix(1.0, exp(-tau / max(abs(across), 0.02)), inRing);
#endif

#ifdef OCCLUDERS
  // An eclipse: each occluder's disc against the Sun's, as angles seen from this point. Inside
  // the umbra the Sun is hidden; across the penumbra it is uncovered over the Sun's own
  // angular radius; a disc smaller than the Sun's leaves an annulus (the antumbra) lit.
  float sunAngle = max(sunRadius / sunDist, 1e-6);
  float shadow = 1.0;
  for (int k = 0; k < OCCLUDERS; k++) {
    vec4 body = occluders[k];
    if (body.w <= 0.0) continue;
    vec3 toBody = body.xyz - vWorld;
    float along = dot(toBody, sunDir);
    if (along <= 0.0 || along >= sunDist) continue;
    float apart = length(toBody - sunDir * along) / along;
    float cover = body.w / along;
    // A disc at least the Sun's size hides it fully inside |cover − sun|; a smaller one hides
    // (cover / sun)² of it at most, the antumbra's annulus staying lit.
    float part = min(cover / sunAngle, 1.0);
    shadow *= 1.0 - part * part * (1.0 - smoothstep(abs(cover - sunAngle), cover + sunAngle, apart));
  }
  diffuse *= shadow;
#endif

  vec3 albedo = texture2D(map, vUv).rgb * mapTint;
  if (fade < 1.0) albedo = mix(texture2D(prior, vUv).rgb * priorTint, albedo, fade);
  if (later > 0.0) albedo = mix(albedo, texture2D(laterMap, vUv).rgb, later);
  // The floor is the display's, whatever the Sun's strength: a night side never pure black,
  // and lit by the sky's own colour where a host has one.
  vec3 col = albedo * (ambient * skylight + (1.0 - ambient) * diffuse * sunlight);

  // Specular glint, only on the day side of bodies with specular reflection.
  if (specStrength > 0.0 && ndl > 0.0) {
    vec3 halfV = normalize(sunDir + viewDir);
    col += pow(max(dot(n, halfV), 0.0), specPower) * specStrength * ndl * sunlight;
  }

  // Haze: Fresnel rim, brighter where the Sun lights the limb.
  if (atmosStrength > 0.0) {
    float fresnel = fresnelRim(n, viewDir, 2.35);
    col += atmos * fresnel * atmosStrength * (0.15 + 0.85 * mu0) * sunlight;
  }

  gl_FragColor = linearToOutputTexel(vec4(col, 1.0));
}
