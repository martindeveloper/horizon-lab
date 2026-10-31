// Atmosphere shell: single scattering of sunlight along the view ray through a thin shell
// of air (Rayleigh) and haze (Mie) over a body, drawn over its surface in a close-up. The
// ray from the camera enters the shell at this fragment and leaves at the far side or the
// surface; AIR_STEPS segments along it (the quality's) each add the light the Sun scatters
// towards the camera there, dimmed by the air between the segment and the Sun (Schüler's
// closed form of the Chapman function, so no second march) and between the segment and the
// camera, for the share of the segment outside the body's shadow (taken exactly, so the
// terminator never steps by a sample). What is left of the view ray's transmittance shows the surface through. A deep
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
uniform vec3 uSunlight;  // the Sun's light, linear: white at today's strength unless a host writes it

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
  // The fragment lies on the mesh's flat facet, a little inside the true sphere: the march
  // starts where the ray meets the sphere itself (t0, a hair behind the fragment), or a
  // grazing view would read each facet ring's few kilometres as a step in the air's depth.
  vec3 ray = normalize(vObject - uCamera);
  float b = dot(vObject, ray);
  float c = dot(vObject, vObject);
  float shell = sqrt(max(b * b - c + 1.0, 0.0));
  float t0 = -b - shell;
  float t1 = -b + shell;
  float ground = b * b - c + uPlanet * uPlanet;
  if (ground > 0.0) {
    float surface = -b - sqrt(ground);
    if (surface > t0) t1 = min(t1, surface);
  }
  float ds = (t1 - t0) / float(AIR_STEPS);

  float cosTheta = dot(ray, uSun);
  float phaseAir = 3.0 / (16.0 * PI) * (1.0 + cosTheta * cosTheta);
  float g2 = uMieG * uMieG;
  float phaseHaze = 3.0 / (8.0 * PI) * (1.0 - g2) * (1.0 + cosTheta * cosTheta)
    / ((2.0 + g2) * pow(1.0 + g2 - 2.0 * uMieG * cosTheta, 1.5));
  vec2 radiusInScales = uPlanet / uScale;

  // The body's shadow along the ray, [x, y]: where the ray runs inside the cylinder of the
  // body's radius behind it, on the far side of the plane through its centre facing the Sun.
  // Each segment is lit for the share of it outside, so the shadow's edge falls where it truly
  // lies, not at the next sample: a sample lit or dark entire would step the light by a
  // whole segment's worth, drawn as bands parallel to the limb near the terminator.
  vec2 shadow = vec2(0.0, -1.0);
  vec3 across = vObject - dot(vObject, uSun) * uSun;
  vec3 drift = ray - dot(ray, uSun) * uSun;
  float qa = dot(drift, drift);
  float qb = dot(across, drift);
  float qc = dot(across, across) - uPlanet * uPlanet;
  float qd = qb * qb - qa * qc;
  if (qa > 1e-9 && qd > 0.0) {
    shadow = (vec2(-qb, -qb) + vec2(-1.0, 1.0) * sqrt(qd)) / qa;
  } else if (qc < 0.0) {
    shadow = vec2(-1e9, 1e9);
  }
  float facing = dot(vObject, uSun);
  float towards = dot(ray, uSun);
  if (abs(towards) > 1e-9) {
    float plane = -facing / towards;
    if (towards > 0.0) shadow.y = min(shadow.y, plane);
    else shadow.x = max(shadow.x, plane);
  } else if (facing >= 0.0) {
    shadow = vec2(0.0, -1.0);
  }

  vec3 light = vec3(0.0);
  vec2 depthToCamera = vec2(0.0);
  for (int i = 0; i < AIR_STEPS; i++) {
    float ta = t0 + float(i) * ds;
    float tb = ta + ds;
    vec3 p = vObject + ray * (ta + 0.5 * ds);
    float r = length(p);
    vec2 h = vec2(r - uPlanet) / uScale;
    vec2 column = exp(-h) * ds;
    vec2 before = depthToCamera;
    depthToCamera += column;
    float lit = 1.0 - max(0.0, min(tb, shadow.y) - max(ta, shadow.x)) / max(ds, 1e-9);
    if (lit <= 0.0) continue;
    // The segment scatters from the middle of its lit part (the larger, if the shadow splits it).
    float tm = ta + 0.5 * ds;
    if (lit < 1.0) {
      bool lead = shadow.x > ta && (shadow.y >= tb || shadow.x - ta >= tb - shadow.y);
      tm = lead ? 0.5 * (ta + shadow.x) : 0.5 * (shadow.y + tb);
      p = vObject + ray * tm;
      r = length(p);
      h = vec2(r - uPlanet) / uScale;
    }
    float cosChi = dot(p, uSun) / r;
    vec2 depthToSun = vec2(
      chapman(radiusInScales.x, h.x, cosChi),
      chapman(radiusInScales.y, h.y, cosChi)
    ) * uScale;
    vec2 seen = before + column * ((tm - ta) / ds);
    vec2 depth = (seen + depthToSun) * uDeep;
    vec3 reach = exp(-(uRayleigh * depth.x + uMie * depth.y));
    light += reach * (uRayleigh * phaseAir * column.x + uMie * phaseHaze * column.y) * lit;
  }
  vec3 through = exp(-(uRayleigh * depthToCamera.x + uMie * depthToCamera.y) * uDeep);
  float hidden = 1.0 - dot(through, vec3(1.0 / 3.0));
  gl_FragColor = linearToOutputTexel(vec4(light * uLight * uSunlight, hidden));
}
