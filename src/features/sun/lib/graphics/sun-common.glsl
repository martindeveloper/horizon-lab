// What every Sun-lab shader shares: the light (its mode, temperature response and colour
// ramp), the wedge cut, the clocks, the surface's rotation law and the display's gamut.
#include <horizon/math>
#include "./parameters.generated.glsl"

uniform int uLightMode;        // LIGHT_WHITE, LIGHT_BAND, LIGHT_ECLIPSE or LIGHT_MAGNETOGRAM
uniform sampler2D uResponse;   // the model's response over log T, a row per layer (LAYER_*): the curve, then convolved with each layer's spread
uniform float uBandScale;      // the band's exposure: 1 over its brightest layer's response
uniform vec4 uWeights;         // how much the photosphere, chromosphere, transition region and corona show in the light
uniform float uFlareWeight;    // and the flare's plasma
uniform int uStreamerCount;
uniform vec4 uStreamer[STREAMER_MAX]; // a helmet streamer's direction (its loop's apex); its apex's height, radii
uniform int uHoleCount;
uniform vec4 uHole[HOLE_MAX];         // a coronal hole's direction (an open line's foot); its strength
uniform sampler2D uRamp;       // the light's colour ramp, linear, dark to bright
uniform vec2 uCut;             // the wedge's half-angle (0: closed) and its bisector's azimuth
uniform vec2 uClock;           // granule lifetimes and network lifetimes elapsed
uniform float uTurn;           // the equator's rotation, radians
uniform float uPixelWorld;     // world length of one buffer pixel, per unit distance from the camera
uniform mat3 uGamut;           // linear sRGB to the canvas's primaries
uniform vec3 uGold;            // the theme's gold, linear

// A nearest-filtered float table interpolated by hand, so no float-linear extension is needed.
vec4 sample1D(sampler2D table, float x, int size) {
  float at = clamp(x, 0.0, 1.0) * float(size - 1);
  float lo = floor(at);
  vec4 a = texture2D(table, vec2((lo + 0.5) / float(size), 0.5));
  vec4 b = texture2D(table, vec2((min(lo + 1.0, float(size - 1)) + 0.5) / float(size), 0.5));
  return mix(a, b, at - lo);
}

// The band's response to a layer of plasma at ln K (`layer`: LAYER_POINT for one temperature,
// else the layer whose spread the model's curve is convolved with), read from the table.
float layerResponse(float lnK, int layer) {
  float x = (lnK / LN10 - RESPONSE_LOG_MIN) / (RESPONSE_LOG_MAX - RESPONSE_LOG_MIN);
  float at = clamp(x, 0.0, 1.0) * float(RESPONSE_SAMPLES - 1);
  float lo = floor(at);
  float row = (float(layer) + 0.5) / float(RESPONSE_ROWS);
  float a = texture2D(uResponse, vec2((lo + 0.5) / float(RESPONSE_SAMPLES), row)).r;
  float b = texture2D(uResponse, vec2((min(lo + 1.0, float(RESPONSE_SAMPLES - 1)) + 0.5) / float(RESPONSE_SAMPLES), row)).r;
  return mix(a, b, at - lo);
}

// The band's response to one temperature.
float bandResponse(float kelvin) {
  return layerResponse(log(max(kelvin, 1.0)), LAYER_POINT);
}

// How open the field is over a direction: a coronal hole there, or the dipole's cap.
float openness(vec3 u, float dipole) {
  float holes = 0.0;
  for (int k = 0; k < HOLE_MAX; k++) {
    if (k >= uHoleCount) break;
    vec4 hole = uHole[k];
    holes = max(holes, hole.w * exp(-(1.0 - dot(u, hole.xyz)) / HOLE_WIDTH));
  }
  float poles = exp(-(1.0 - abs(u.y)) / PLUME_WIDTH) * abs(dipole);
  return max(holes, poles);
}

// A band's intensity as its ramp colours it: 1 − e^(−gain · I) along the ramp.
vec3 rampAt(float intensity) {
  return sample1D(uRamp, 1.0 - exp(-BAND_GAIN * intensity), RAMP_SAMPLES).rgb;
}

// A point of the unit sphere turned `angle` about the pole.
vec3 turned(vec3 p, float angle) {
  float ca = cos(angle);
  float sa = sin(angle);
  return vec3(ca * p.x + sa * p.z, p.y, -sa * p.x + ca * p.z);
}

// The surface's rotation at a latitude (its sine `y`) over the equator's: Ω(φ)/Ω₀.
float surfaceTurnRatio(float y) {
  float y2 = y * y;
  return 1.0 + ROTATION_SIN2 * y2 + ROTATION_SIN4 * y2 * y2;
}

// The body turns with its equator: world = turned(body, uTurn). A shader works in the body
// frame, where the frame's regions, lines and anchors are given, so it turns the camera's ray
// into it first; what is fixed in the world (the wedge facing the visitor, its key light) turns
// the other way.
vec3 toBody(vec3 world) {
  return turned(world, -uTurn);
}

// The wedge's bisector in the body frame: `turned` takes an azimuth down by its angle, so a
// world azimuth is a body azimuth plus the turn.
float cutAzimuth() {
  return uCut.y + uTurn;
}

// Whether a point of the body frame lies in the wedge the cut has opened.
bool inWedge(vec3 p) {
  if (uCut.x <= 0.0) return false;
  float a = atan(p.z, p.x) - cutAzimuth();
  a -= TWO_PI * floor((a + PI) / TWO_PI);
  return abs(a) < uCut.x;
}

// The wedge's two faces as planes through the pole, their normals pointing into the gap.
void wedgeNormals(out vec3 a, out vec3 b) {
  float lo = cutAzimuth() - uCut.x;
  float hi = cutAzimuth() + uCut.x;
  a = vec3(-sin(lo), 0.0, cos(lo));
  b = vec3(sin(hi), 0.0, -cos(hi));
}

// Where a ray meets the unit sphere: its entry and exit distances; false when it misses.
bool raySphere(vec3 o, vec3 d, float radius, out float t0, out float t1) {
  float b = dot(o, d);
  float c = dot(o, o) - radius * radius;
  float disc = b * b - c;
  if (disc < 0.0) return false;
  float s = sqrt(disc);
  t0 = -b - s;
  t1 = -b + s;
  return t1 > 0.0;
}

// Where a ray meets the Sun: the photosphere (face 0) or a cut face (1, 2), and the point;
// false past the gap. The gap is convex, so a ray inside it leaves through a face or the sphere.
bool traceSun(vec3 o, vec3 d, out vec3 p, out int face) {
  float t0;
  float t1;
  if (!raySphere(o, d, 1.0, t0, t1)) return false;
  t0 = max(t0, 0.0);
  p = o + d * t0;
  face = 0;
  if (!inWedge(p)) return true;
  vec3 na;
  vec3 nb;
  wedgeNormals(na, nb);
  float best = t1;
  float dna = dot(d, na);
  if (dna < 0.0) {
    float t = -dot(o, na) / dna;
    if (t > t0 && t < best) {
      best = t;
      face = 1;
    }
  }
  float dnb = dot(d, nb);
  if (dnb < 0.0) {
    float t = -dot(o, nb) / dnb;
    if (t > t0 && t < best) {
      best = t;
      face = 2;
    }
  }
  if (face == 0) return false;
  p = o + d * best;
  return true;
}

// A feature `perRadius` across the radius, seen at `mu` with a buffer pixel `px` wide there:
// 0 below two pixels, 1 above four. Filtering changes visibility, never a feature's size.
float resolvedFeature(float perRadius, float px, float mu) {
  float pixels = max(mu, 0.02) / (max(perRadius, 1.0) * max(px, 1e-9));
  return smoothstep(SURFACE_RESOLVE_PX, 2.0 * SURFACE_RESOLVE_PX, pixels);
}

