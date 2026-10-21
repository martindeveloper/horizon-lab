// Atmosphere shell: single scattering of sunlight along the view ray through a thin shell
// of air (Rayleigh) and haze (Mie) over a body, drawn over its surface in a close-up. The
// ray from the camera enters the shell at this fragment and leaves at the far side or the
// surface; AIR_STEPS samples along it (the quality's) each add the light the Sun scatters
// towards the camera there, dimmed by the air between the sample and the Sun (Schüler's
// closed form of the Chapman function, so no second march) and between the sample and the
// camera. What is left of the view ray's transmittance shows the surface through. A deep
// haze scatters nearly all it takes from a ray onwards, much of it towards the camera, so it
// dims light less than single scattering says: uDeep scales every path's extinction (1 for
// thin air), which keeps a hazy limb as bright as the cloud deck under it. Everything
// is in the shell's own units (air.ts: the shell is the unit sphere, the body the sphere of
// radius uPlanet), lit by the Sun in direction uSun. The output is premultiplied: the
// scattered light, and the share of the background the air hides.

uniform vec3 uCamera;    // camera position, shell space
uniform vec3 uSun;       // direction to the Sun, shell space, unit
uniform float uPlanet;   // the body's radius; the shell's is 1
uniform vec2 uScale;     // scale heights of air and haze
uniform vec3 uRayleigh;  // air's scattering per unit length at the surface, RGB
uniform vec3 uMie;       // haze's scattering per unit length at the surface, RGB
uniform float uMieG;     // haze's forward-scattering asymmetry
uniform float uDeep;     // share of each path's extinction that dims light (less for a deep haze)
uniform float uLight;    // sunlight on the shell

varying vec3 vObject;

#include <horizon/math>
#include <horizon/log-depth>

// Air above altitude h (in scale heights) along a ray at zenith angle χ, in scale heights
// times the surface density, for a body X scale heights in radius: Schüler's approximation
// of the Chapman grazing-incidence function (GPU Pro 3, 2012). Rays going down (cosChi < 0)
// pass their lowest point and climb out again.
float chapman(float X, float h, float cosChi) {
  float c = sqrt(X + h);
  if (cosChi >= 0.0) return c / (c * cosChi + 1.0) * exp(-h);
  float x0 = sqrt(1.0 - cosChi * cosChi) * (X + h);
  float c0 = sqrt(x0);
  return 2.0 * c0 * exp(X - x0) - c / (1.0 - c * cosChi) * exp(-h);
}

void main() {
  logDepthFragment();
  // The ray enters the shell at this fragment (only the shell's outside faces draw, so the
  // camera is outside it). Intersections are taken from here, where every term is about 1,
  // not from the camera, which may be hundreds of radii away: float32 would cancel there.
  vec3 ray = normalize(vObject - uCamera);
  float b = dot(vObject, ray);
  float c = dot(vObject, vObject);
  float t1 = -b + sqrt(max(b * b - c + 1.0, 0.0));
  float ground = b * b - c + uPlanet * uPlanet;
  if (ground > 0.0) {
    float surface = -b - sqrt(ground);
    if (surface > 0.0) t1 = min(t1, surface);
  }
  float ds = t1 / float(AIR_STEPS);

  float cosTheta = dot(ray, uSun);
  float phaseAir = 3.0 / (16.0 * PI) * (1.0 + cosTheta * cosTheta);
  float g2 = uMieG * uMieG;
  float phaseHaze = 3.0 / (8.0 * PI) * (1.0 - g2) * (1.0 + cosTheta * cosTheta)
    / ((2.0 + g2) * pow(1.0 + g2 - 2.0 * uMieG * cosTheta, 1.5));
  vec2 radiusInScales = uPlanet / uScale;

  vec3 light = vec3(0.0);
  vec2 depthToCamera = vec2(0.0);
  for (int i = 0; i < AIR_STEPS; i++) {
    vec3 p = vObject + ray * ((float(i) + 0.5) * ds);
    float r = length(p);
    vec2 h = vec2(r - uPlanet) / uScale;
    vec2 density = exp(-h);
    depthToCamera += density * ds;
    float cosChi = dot(p, uSun) / r;
    // In the body's shadow: the Sun is below the horizon and its ray would pass through the ground.
    bool night = cosChi < 0.0 && r * sqrt(1.0 - cosChi * cosChi) < uPlanet;
    if (night) continue;
    vec2 depthToSun = vec2(
      chapman(radiusInScales.x, h.x, cosChi),
      chapman(radiusInScales.y, h.y, cosChi)
    ) * uScale;
    vec2 depth = (depthToCamera + depthToSun) * uDeep;
    vec3 reach = exp(-(uRayleigh * depth.x + uMie * depth.y));
    light += reach * (uRayleigh * phaseAir * density.x + uMie * phaseHaze * density.y) * ds;
  }
  vec3 through = exp(-(uRayleigh * depthToCamera.x + uMie * depthToCamera.y) * uDeep);
  float hidden = 1.0 - dot(through, vec3(1.0 / 3.0));
  gl_FragColor = linearToOutputTexel(vec4(light * uLight, hidden));
}
