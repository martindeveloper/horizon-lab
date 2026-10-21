// Giants fragment shader.
//
// Every body in view is a globe, ray-traced in one pass from its centre and radii (CSS pixels
// from the top left), so it stays round and sharp at any zoom. A pixel on a globe finds its
// point on the sphere, turned by the body's spin and tilted pole, so the surface rotates.
//
// Stars shine by their own light (`surface.glsl`): each point has a temperature (pole to
// equator on the fast spinners, up and down with the convection cells and pulsations, cooler
// in spots, hotter in faculae). Integrated Planck colours and atmosphere-based limb profiles
// describe the continuum; only the focused star evaluates its resolved fine structure. Beyond
// the limb (`weather.glsl`) glow the winds and shells of the stars that have them, and the star
// the camera rests on comes alive: corona, chromosphere and spicules, prominences, flares,
// their loops and ejections, as the activity model places them. Earth and Jupiter are lit from
// the upper left from their measured maps. A horizon is drawn at its own radius, black.
//
// A flattened body (Vega, Achernar, Jupiter, Earth) is a spheroid with its pole tipped towards
// us: its silhouette is the ellipse that tilt projects, and each pixel's ray meets the spheroid
// itself, so its shading and its surface's turn follow the true shape.

precision highp float;

#include "./parameters.generated.glsl"
#include <horizon/noise>
#include <horizon/convection>
#include <horizon/temperature>
#include <horizon/tonemap>
#include <horizon/display>

uniform vec2 uResolution;               // drawing buffer, pixels
uniform float uPixelRatio;              // buffer pixels per CSS pixel
uniform float uBaseline;                // the line the bodies stand on, CSS pixels from the top
uniform float uTime;                    // seconds, drives everything that moves
uniform float uDetail;                  // 0: the main layers; 1: their finer companions too
uniform vec2 uFocus;                    // one detailed surface's slot, and its faded quality budget
uniform highp sampler2D uSpectrum;      // CIE continuum: normalized RGB, log Y
uniform highp sampler2D uProfiles;      // each disc: R,V,B limb laws; latitude temperature
uniform int uCount;                     // bodies in use
uniform vec4 uShape[MAX_DISCS];         // centre x, y; equatorial and polar radius
uniform vec4 uBody[MAX_DISCS];          // style; equator and pole temperature, K; seed
uniform vec4 uSurface[MAX_DISCS];       // cells across the radius; haze; uncertain edge; limb roughness
uniform vec4 uGlobe[MAX_DISCS];         // turn, radians; pole tilt towards us, radians; polar over equatorial radius; pulsation (a hole's flaring)
uniform vec4 uLens[LENSES];             // each black hole, in view or not: centre x, y; horizon radius, CSS px; how strongly it bends the stars
uniform vec4 uRing[MAX_DISCS];          // a hole's photon ring: glow; its light's temperature, K; flicker; angle it is brightest at
uniform highp sampler2D uTints;         // each disc's tints: linear light; log reference radiance (`tints.ts`)
uniform int uHoles[LENSES];             // the discs that are black holes in view, the first `uHoleCount`
uniform int uHoleCount;
uniform vec4 uWeather;                  // the star in focus's disc (−1: none); its weather's presence, 0–1; corona; chromosphere
uniform vec4 uRegion[REGIONS];          // active region's centre (body frame); angular radius
uniform vec4 uRegionState[REGIONS];     // strength; tilt; flare light; 1 for a dust veil
uniform vec4 uRegionView[REGIONS];      // its centre in the view; strength
uniform vec4 uSheetInfo[SHEETS];        // first column's position angle; step; brightness; own light
uniform vec4 uSheet[SHEETS * SHEET_POINTS]; // column's underside and top, radii; top's depth; hollow
uniform vec4 uLoopBound[LOOPS];         // centre x, y and reach, radii; brightness
uniform vec4 uLoop[LOOPS * LOOP_POINTS]; // x, y, z; width, radii
uniform vec4 uEjection[EJECTIONS];      // position angle; front, radii; spread, radians; brightness
uniform vec4 uFlash[ARCADES];           // each flare lit: its site x, y, z; its light
uniform vec3 uOrbitCentre;              // centre x, y; 1 while any ring shows (0: none)
uniform vec2 uOrbits[ORBIT_COUNT];      // each ring's radius, CSS pixels, and how much of it shows
uniform vec3 uAccent;                   // the house gold, linear
uniform vec3 uBalmer;                   // the Balmer lines' pink, linear
uniform vec3 uAlkali;                   // what a brown dwarf's sodium and potassium leave of its light
uniform vec3 uSky;                      // the space background, linear
uniform sampler2D uEarth;               // measured maps, equirectangular
uniform sampler2D uJupiter;
uniform vec2 uMaps;                     // 1 once Earth's, Jupiter's map has arrived
uniform vec3 uEarthMean;                // their mean colours meanwhile, linear
uniform vec3 uJupiterMean;
uniform mat3 uGamut;                    // linear sRGB to the canvas's primaries (the pass's)

const float PI = 3.14159265;
const float TAU = 6.2831853;

// Disc `i`'s tint `tint` (`TINT_*`): linear RGB, log reference visible radiance in alpha.
vec4 tintOf(int i, int tint) {
  return texture2D(uTints, (vec2(float(tint), float(i)) + 0.5) / vec2(float(TINT_COUNT), float(MAX_DISCS)));
}

/* ------------------------------------------------------------------ globes */

// Where the ray through a pixel meets a spheroid whose pole is tipped `tilt` towards us, in
// units of the equatorial radius. Returns the point on the matching unit sphere (for surface
// patterns and maps) and, through `normal`, the surface normal in view space.
vec3 hitSpheroid(vec2 v, float tilt, float flattening, out vec3 normal) {
  /* Tipped towards us: the north pole shows. */
  float ct = cos(tilt);
  float st = -sin(tilt);
  /* The orthographic ray (v, 2) → (v, −∞), turned into the body's frame and squashed to a sphere. */
  vec3 o = vec3(v.x, ct * v.y - st * 2.0, st * v.y + ct * 2.0);
  vec3 d = vec3(0.0, st, -ct);
  o.y /= flattening;
  d.y /= flattening;
  float a = dot(d, d);
  float b = dot(o, d);
  float c = dot(o, o) - 1.0;
  float t = (-b - sqrt(max(b * b - a * c, 0.0))) / a;
  vec3 unit = normalize(o + t * d);
  vec3 g = vec3(unit.x, unit.y / flattening, unit.z);
  vec3 nb = normalize(g);
  normal = vec3(nb.x, ct * nb.y + st * nb.z, -st * nb.y + ct * nb.z);
  return unit;
}

// A point of the unit sphere turned `angle` about the pole.
vec3 turned(vec3 p, float angle) {
  float ca = cos(angle);
  float sa = sin(angle);
  return vec3(ca * p.x + sa * p.z, p.y, -sa * p.x + ca * p.z);
}

#include "./stellar-light.glsl"
#include "./surface.glsl"
#include "./weather.glsl"
#include "./hole.glsl"

// Equirectangular map coordinates with no seam where longitude wraps (Tarini 2012).
vec2 globeUv(vec3 s) {
  float lon = atan(s.x, s.z) / TAU;
  float u1 = fract(lon);
  float u2 = fract(lon + 0.5) - 0.5;
  float u = fwidth(u1) <= fwidth(u2) + 1e-6 ? u1 : u2;
  return vec2(u, 0.5 + asin(clamp(s.y, -1.0, 1.0)) / PI);
}

vec3 planetSurface(vec3 n, vec3 s, float mu, int style) {
  vec3 light = normalize(vec3(-0.62, 0.38, 0.69));
  float lit = max(dot(n, light), 0.0);
  vec2 uv = globeUv(s);
  if (style == STYLE_EARTH) {
    vec3 albedo = uMaps.x > 0.5 ? texture2D(uEarth, uv).rgb : uEarthMean;
    vec3 colour = albedo * (0.015 + 1.5 * lit);
    /* The thin blue air, brightest at the lit limb. */
    float air = pow(1.0 - mu, 3.0);
    return colour + vec3(0.18, 0.35, 0.9) * air * (0.08 + 1.1 * lit);
  }
  vec3 albedo = uMaps.y > 0.5 ? texture2D(uJupiter, uv).rgb : uJupiterMean;
  return albedo * (0.01 + 1.45 * lit) * (0.55 + 0.45 * mu);
}

// How far beyond its radius a body's light reaches, in radii: the star in focus's corona and
// ejections, a pulsar's beams, a wind or shell, or the soft glow every star has. Light is
// drawn only inside a square this many radii from the centre, so each fades out within it.
float reachOf(int i, int style) {
  if (float(i) == uWeather.x) return max(CORONA_REACH, EJECTION_REACH);
  if (style == STYLE_PULSAR) return BEAM_REACH;
  if (style == STYLE_HORIZON) return 1.2;
  if (uSurface[i].y > 0.0) return ENVELOPE_REACH;
  return GLOW_REACH;
}

// One body at a pixel: its light (premultiplied) and how much of the pixel it covers.
vec4 shade(vec2 p, int i, int style) {
  vec4 shape = uShape[i];
  vec4 body = uBody[i];
  vec4 surface = uSurface[i];
  vec4 globe = uGlobe[i];
  /* In equatorial radii, y up; and with the silhouette's ellipse made a unit circle. */
  vec2 o = vec2(p.x - shape.x, shape.y - p.y) / shape.z;
  float r = length(o);
  vec2 q = vec2(o.x, o.y * shape.z / shape.w);
  float aa = 1.0 / shape.z;

  if (style == STYLE_HORIZON) return horizon(o, shape.z);

  bool star = style != STYLE_EARTH && style != STYLE_JUPITER;
  bool weather = float(i) == uWeather.x && uWeather.y > 0.0;
  float detail = float(i) == uFocus.x ? uFocus.y : 0.0;
  vec2 dir = o / max(r, 1e-5);
  /* A lumpy limb: the relief of a few giant cells. Its bumps move the edge by at most
     `GRADIENT_FBM_BOUND` times its roughness, so a pixel further out than that past the face
     and its veil is beyond them whatever they do, and they are not worked out there. */
  float lumps = 1.0 + surface.w * GRADIENT_FBM_BOUND;
  if (surface.w > 0.0 && length(q) < (1.0 + max(surface.z, aa)) * lumps) {
    vec3 limbNormal;
    vec2 limb = normalize(q + vec2(1e-8)) * 0.99999;
    vec3 limbPoint = turned(hitSpheroid(vec2(limb.x, limb.y * shape.w / shape.z), globe.y, globe.z, limbNormal), globe.x);
    q /= 1.0 + surface.w * giantField(limbPoint, body.w);
  }
  float d = length(q);

  vec3 outside = vec3(0.0);
  vec3 front = vec3(0.0);
  if (star && d > 1.0 - 2.0 * aa) {
    outside = tintOf(i, TINT_GLOW).rgb * GLOW * exp(-max(r - 1.0, 0.0) * GLOW_FALLOFF);
    if (surface.y > 0.0) outside += envelope(r, dir, style, surface.y, i, body.w);
    if (style == STYLE_PULSAR) outside += beams(o, r, globe, tintOf(i, TINT_FACE).rgb);
    if (weather) {
      float phi = atan(o.y, o.x);
      vec3 tint = tintOf(i, TINT_FACE).rgb;
      vec3 live = sheets(r, phi, shape.z, tintOf(i, TINT_PLUME).rgb) + ejections(o, r, tint, body.w);
      if (uWeather.z > 0.0 && r < CORONA_REACH) live += uWeather.z * corona(r, dir, tint, body.w, globe);
      if (uWeather.w > 0.0) live += uWeather.w * chromosphere(max(r - 1.0, 0.0), phi, shape.z, body.w);
      outside += uWeather.y * live;
    }
  }
  if (weather) {
    vec3 faceNormal;
    vec3 facePoint = hitSpheroid(o, globe.y, globe.z, faceNormal);
    vec3 physicalPoint = facePoint * vec3(1.0, globe.z, 1.0);
    float frontDepth = d < 1.0 ? toView(physicalPoint, 0.0, globe.y).z : -1e4;
    front = uWeather.y * (loops(o, r, shape.z, frontDepth) + flash(o));
  }

  /* The face is sharp at its catalogued radius; one known only to a spread glows softly out
     to the top of it, a veil the ball stands in. */
  float covered = 1.0 - smoothstep(1.0 - aa, 1.0 + aa, d);
  if (star && surface.z > 0.0 && d < 1.0 + surface.z)
    outside += tintOf(i, TINT_VEIL).rgb * SPREAD_VEIL * pow(1.0 - smoothstep(1.0, 1.0 + surface.z, d), 2.0);
  if (covered <= 0.0) return vec4(outside + front, 0.0);

  /* Too small to show a surface: a point of the right colour. */
  if (shape.z < 2.0) {
    vec3 point = star ? tintOf(i, TINT_FACE).rgb : (style == STYLE_EARTH ? uEarthMean : uJupiterMean);
    return vec4(point * covered + outside, covered);
  }

  vec2 v = vec2(q.x, q.y * shape.w / shape.z) * min(1.0, 0.9995 / max(d, 1e-4));
  vec3 n;
  vec3 s = turned(hitSpheroid(v, globe.y, globe.z, n), globe.x);
  float mu = clamp(n.z, 0.0, 1.0);
  vec3 light = star
    ? starSurface(s, mu, style, body, surface, globe, shape.z, weather, tintOf(i, TINT_FACE).a, i, detail)
    : planetSurface(n, s, mu, style);
  if (star && surface.y > 0.0) {
    /* Seen through its own shell or wind towards the limb. */
    light = mix(light, tintOf(i, TINT_HAZE).rgb * 0.6, surface.y * 0.35 * (1.0 - mu) * (1.0 - mu));
  }
  return vec4(light * covered + outside * (1.0 - covered) + front, covered);
}

/* -------------------------------------------------------------------- sky */

// Where a pixel's starlight comes from: bent round every black hole near it as by a point
// mass, β = θ (1 − θ_E²/θ²), so stars behind one smear into arcs round its Einstein ring. The
// bending eases off to nothing by `LENS_REACH`, and with the camera's distance along the ladder
// from the hole (`uLens.w`). Inside a hole's shadow no starlight from behind gets through: z is
// 0 there.
vec3 lensed(vec2 p) {
  vec2 from = p;
  float through = 1.0;
  for (int k = 0; k < LENSES; k++) {
    vec4 lens = uLens[k];
    if (lens.w <= 0.0) continue;
    vec2 d = p - lens.xy;
    float b = length(d) / lens.z;
    if (b > LENS_REACH) continue;
    float ease = (1.0 - smoothstep(0.5 * LENS_REACH, LENS_REACH, b)) * lens.w;
    from -= d * (LENS_EINSTEIN * LENS_EINSTEIN / max(b * b, 1e-3)) * ease;
    through *= 1.0 - lens.w * (1.0 - smoothstep(HOLE_SHADOW - 0.04, HOLE_SHADOW, b));
  }
  return vec3(from, through);
}

// The background stars at `p`, and the baseline the bodies stand on.
vec3 sky(vec2 p) {
  vec2 line = p;
  vec3 seen = lensed(p);
  p = seen.xy;
  vec2 cell = floor(p / 5.0);
  vec2 inCell = fract(p / 5.0) * 5.0;
  float h = hash21(cell);
  vec3 colour = uSky;
  if (h > 0.985) {
    vec2 spot = vec2(hash21(cell + 7.1), hash21(cell + 3.3)) * 4.0 + 0.5;
    float point = exp(-dot(inCell - spot, inCell - spot) * 1.6);
    float bright = (h - 0.985) / 0.015;
    colour += blackbodyLinear(mix(3500.0, 12000.0, hash21(cell + 1.9))) * point * 0.5 * bright * bright * seen.z;
  }
  /* Black holes' photon rings glow in the sky, behind every body. */
  for (int k = 0; k < LENSES; k++) {
    if (k >= uHoleCount) break;
    int i = uHoles[k];
    vec4 shape = uShape[i];
    vec2 offset = abs(line - shape.xy);
    float reach = shape.z * HOLE_REACH + 2.0;
    if (offset.x > reach || offset.y > reach) continue;
    vec2 o = vec2(line.x - shape.x, shape.y - line.y) / shape.z;
    colour += photonRing(o, shape.z, uRing[i], uBody[i].w);
  }
  float baseline = 1.0 - smoothstep(0.0, 1.0 / uPixelRatio + 0.4, abs(line.y - uBaseline));
  return colour + uAccent * BASELINE_ALPHA * baseline;
}

void main() {
  vec2 p = vec2(gl_FragCoord.x, uResolution.y - gl_FragCoord.y) / uPixelRatio;
  vec3 colour = sky(p);

  /* Largest first, so each smaller body is drawn over the one behind it. */
  for (int i = 0; i < MAX_DISCS; i++) {
    if (i >= uCount) break;
    vec4 shape = uShape[i];
    int style = int(uBody[i].x + 0.5);
    vec2 offset = abs(p - shape.xy);
    float reach = shape.z * reachOf(i, style) + 2.0;
    if (offset.x > reach || offset.y > reach) continue;
    vec4 body = shade(p, i, style);
    colour = colour * (1.0 - body.a) + body.rgb;
  }

  /* Hue kept through the tone curve, so a red star stays red and keeps its limb darkening. */
  vec3 shown = tonemapHue(uGamut * colour, EXPOSURE, SHOULDER, SATURATION, HIGHLIGHT_WHITE);

  /* The orbits over everything, after the tone curve so their gold is the theme's: a dark
     casing either side of each line keeps it legible across a bright face as on the sky. */
  if (uOrbitCentre.z > 0.0) {
    float r = length(p - uOrbitCentre.xy);
    float line = 0.0;
    float casing = 0.0;
    for (int k = 0; k < ORBIT_COUNT; k++) {
      vec2 ring = uOrbits[k];
      float d = abs(r - ring.x);
      line = max(line, ring.y * (1.0 - smoothstep(0.35, 1.25, d)));
      casing = max(casing, ring.y * (1.0 - smoothstep(1.25, ORBIT_CASE_PX, d)));
    }
    shown *= 1.0 - ORBIT_CASE_DEPTH * casing;
    shown = mix(shown, uGamut * uAccent, ORBIT_LINE_ALPHA * line);
  }
  gl_FragColor = vec4(displayEncode(shown), 1.0);
}
