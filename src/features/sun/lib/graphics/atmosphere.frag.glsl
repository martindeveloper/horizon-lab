// Light beyond the limb and over the disc, on the atmosphere's proxy sphere (its back faces,
// so the camera may stand inside it): the chromosphere's rim and its spicule forest, the
// K-corona (Baumbach's fall-off seen with the eye's compression) shaped by the field (helmet
// streamers over the closed regions, plumes over the open poles), the F and E coronae, the
// transition region's and loops' glow over the regions in the hot bands, a flare's flash and
// the ejection's shell along its axis. Added to what is behind; the disc occludes analytically,
// so nothing here needs a depth test and the flash may lie over the face.
precision highp float;

#include "./sun-common.glsl"
#include <horizon/gradient-noise>
#include <horizon/srgb>

uniform int uRegionCount;
uniform vec4 uRegionDir[REGION_MAX];   // centre (body frame); angular radius
uniform vec4 uRegionSide[REGION_MAX];  // across the axis; strength
uniform vec4 uRegionState[REGION_MAX]; // flare; facula; age; seed
uniform vec3 uCorona;                  // Baumbach's three coefficients
uniform vec2 uCoronaFE;                // the F and E coronae's weights
uniform float uDipole;
uniform vec4 uEruption;                // the eruption's axis; its front's radius (0: none)
uniform vec4 uEruptionShape;           // its spread, rad; the flare's light; its rope's height; its strength
uniform int uSamples;                  // march samples through the ejection
uniform float uSpicules;               // 1: spicules drawn
uniform float uSpiculeClock;           // spicule lifetimes elapsed
uniform vec3 uSunlight;                // the photosphere's continuum, linear, for the scattered coronae
uniform vec3 uBalmer;                  // the Balmer lines' pink, linear
uniform vec3 uGreen;                   // Fe XIV's green, linear
varying vec3 vWorld;

// A layer's light in the current light: its own colour in true colour; in a band, the band's
// response to the layer's temperatures, exposed to the band's scale, through the ramp.
vec3 lit(float intensity, float kelvin, int layer, vec3 own, float weight) {
  if (weight <= 0.0 || intensity <= 0.0) return vec3(0.0);
  if (uLightMode == LIGHT_BAND)
    return rampAt(uBandScale * weight * layerResponse(log(kelvin), layer) * intensity);
  return own * weight * intensity;
}

// Baumbach's K-corona at a projected radius, against its value at the limb.
float baumbach(float rho) {
  vec3 powers = vec3(pow(rho, -2.5), pow(rho, -7.0), pow(rho, -17.0));
  return dot(uCorona, powers) / max(dot(uCorona, vec3(1.0)), 1e-6);
}

// A ray's course through the ejection's shell: a bright front along the axis, falling back
// at the flanks, strands of field draped over it and the erupted rope glowing at its heart.
vec3 ejection(vec3 o, vec3 d, float tEnd) {
  float front = uEruption.w;
  if (front <= 1.0) return vec3(0.0);
  float thick = CME_THICKNESS * front;
  float t0;
  float t1;
  if (!raySphere(o, d, front + thick, t0, t1)) return vec3(0.0);
  float begin = max(t0, 0.0);
  float end = min(t1, tEnd);
  if (end <= begin) return vec3(0.0);
  vec3 axis = uEruption.xyz;
  float spread = uEruptionShape.x;
  float step = (end - begin) / float(uSamples);
  float jitter = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
  float t = begin + step * jitter;
  float shell = 0.0;
  float core = 0.0;
  for (int i = 0; i < CORONA_MAX_SAMPLES; i++) {
    if (i >= uSamples) break;
    vec3 x = o + d * t;
    float r = length(x);
    vec3 u = x / max(r, 1e-5);
    float angle = acos(clamp(dot(u, axis), -1.0, 1.0));
    float w = angle / max(spread, 1e-3);
    float flanks = 1.0 - smoothstep(0.55, 1.15, w);
    float edge = front * sqrt(max(1.0 - w * w, 0.0));
    float h = (r - edge) / thick;
    /* A bright, thin front; behind it the cavity, dim, the field's strands draped through. */
    float profile = h > 0.0 ? exp(-8.0 * h * h) : mix(1.0 - CME_CAVITY, 1.0, exp(-2.5 * h * h));
    float strands = 0.5 + 0.5 * gradientNoise3(vec3(u.xy * 6.0 + uEruptionShape.w, (r - edge) * 4.0 / thick));
    shell += profile * flanks * mix(0.35, 1.5, strands);
    float heart = 1.0 + 0.45 * (front - 1.0);
    vec3 off = (x - axis * heart) / (0.04 + 0.1 * (front - 1.0));
    core += exp(-dot(off, off));
    t += step;
  }
  float scale = step * CME_GLOW * uEruptionShape.w / sqrt(front);
  return lit(shell * scale, CORONA_K, LAYER_CORONA, uSunlight, uWeights.w)
    + lit(core * scale * 1.4, CHROMOSPHERE_K, LAYER_CHROMOSPHERE, uBalmer, uWeights.y);
}

void main() {
  /* Into the body frame: the regions, streamers, holes and the ejection's axis are given there. */
  vec3 o = toBody(cameraPosition);
  vec3 d = toBody(normalize(vWorld - cameraPosition));
  float tc = -dot(o, d);
  vec3 q = o + d * tc;
  float rho = length(q);
  vec3 qhat = q / max(rho, 1e-5);
  /* The disc occludes what lies behind its entry point, unless the ray enters the open wedge. */
  float t0;
  float t1;
  bool hits = tc > 0.0 && raySphere(o, d, 1.0, t0, t1) && !inWedge(o + d * max(t0, 0.0));
  float tEnd = hits ? max(t0, 0.0) : 1e6;
  float px = uPixelWorld * max(tc, 0.05);
  vec3 col = vec3(0.0);

  if (!hits && rho >= 1.0) {
    float h = rho - 1.0;
    /* The chromosphere's rim, and its spicules: a forest of jets, each on its own clock. */
    float lon = atan(qhat.z, qhat.x);
    float lat = asin(clamp(qhat.y, -1.0, 1.0));
    float rim = exp(-h / (CHROMOSPHERE_HEIGHT + RIM_MIN_PX * px)) * (0.75 + 0.25 * gradientNoise2(vec2(lon, lat) * 35.0));
    float jets = 0.0;
    float seen = resolvedFeature(SPICULE_COLUMNS / TWO_PI, px, 1.0);
    if (uSpicules > 0.0 && h < SPICULE_HEIGHT && seen > 0.0) {
      vec2 a = vec2(lon, lat) * (SPICULE_COLUMNS / TWO_PI);
      vec3 dice = hash33(vec3(floor(a), 5.0));
      float reach = SPICULE_HEIGHT * (0.3 + 0.7 * dice.x) * (0.6 + 0.4 * sin(uSpiculeClock * TWO_PI * (0.6 + 0.7 * dice.y) + TWO_PI * dice.z));
      float thin = 1.0 - smoothstep(0.12, 0.42, length(fract(a) - 0.5));
      jets = seen * thin * (1.0 - smoothstep(0.5 * reach, reach, h)) * (1.0 - 0.5 * h / SPICULE_HEIGHT);
    }
    float chromo = CHROMOSPHERE_GLOW * rim + SPICULE_GLOW * jets;
    col += lit(chromo, CHROMOSPHERE_K, LAYER_CHROMOSPHERE, uBalmer, uWeights.y);
    /* The transition sheath on the chromosphere's top: what He II shows of the rim. */
    col += lit(PROMINENCE_SHEATH * chromo, TRANSITION_K, LAYER_TRANSITION, uBalmer, uWeights.z);

    /* The K-corona, shaped by the field: a helmet streamer over each high closed loop, broad
       at its base and drawn out into a stalk, dark holes where the field is open with fine
       plumes inside them, the inner corona brightest just off the limb. */
    /* Scattered sunlight falls as Baumbach's law, seen with the eye's compression; the corona's
       own EUV light as its density squared, on its scale height. */
    float fall = uLightMode == LIGHT_BAND ? exp(-h / EUV_SCALE_HEIGHT_R) : pow(baumbach(rho), CORONA_CONTRAST);
    /* A streamer shows as a ray where it stands against the sky; one leaning toward or away
       from us spreads into a broad glow and fades. */
    vec3 axisOfView = normalize(o);
    float streamers = CORONA_FLOOR;
    for (int k = 0; k < STREAMER_MAX; k++) {
      if (k >= uStreamerCount) break;
      vec4 streamer = uStreamer[k];
      vec3 side = streamer.xyz - axisOfView * dot(streamer.xyz, axisOfView);
      float edgeOn = length(side);
      if (edgeOn < 1e-3) continue;
      float apart = 1.0 - dot(qhat, side / edgeOn);
      float width = (STREAMER_STALK + STREAMER_WIDTH / (rho * rho)) / max(edgeOn * edgeOn, 0.15);
      float tail = 1.0 + STREAMER_TAIL * min(h, streamer.w - 1.0) / max(streamer.w - 1.0, 0.05);
      streamers += STREAMER_GLOW * sqrt(edgeOn) * exp(-apart / width) * tail;
    }
    float rays = 1.0 - RAY_SHARE * abs(gradientNoise2(vec2(lon, lat) * RAY_COUNT + uClock.y * 0.05))
      - 0.5 * RAY_SHARE * abs(gradientNoise2(vec2(lon, lat) * RAY_COUNT * 3.0 + uClock.y * 0.08));
    float plumes = pow(1.0 - abs(gradientNoise2(vec2(lon, lat) * PLUME_COUNT)), 3.0);
    float open = openness(qhat, uDipole);
    float inner = INNER_CORONA_GLOW * exp(-h / INNER_CORONA_REACH);
    /* The closed corona at the quiet corona's temperature; the holes' thin plasma cooler and
       fainter, with the plumes; the streamers' cores over the regions hotter. */
    float closed = CORONA_GLOW * (fall * (CORONA_FLOOR + inner) + inner) * rays * (1.0 - open * HOLE_DEPTH);
    float hole = CORONA_GLOW * fall * (HOLE_FLOOR + PLUME_GLOW * plumes) * rays * open * HOLE_DEPTH;
    float hot = CORONA_GLOW * fall * (streamers - CORONA_FLOOR) * rays * (1.0 - open * HOLE_DEPTH);
    col += lit(closed, CORONA_K, LAYER_CORONA, uSunlight, uWeights.w);
    col += lit(hole, HOLE_K, LAYER_CORONA, uSunlight, uWeights.w);
    col += lit(hot, ACTIVE_K, LAYER_CORONA, uSunlight, uWeights.w);
    /* Visible light only: the F-corona, sunlight on dust, flat and unstructured; the E-corona,
       Fe XIV's green line, low and near the regions. */
    if (uLightMode != LIGHT_BAND) {
      col += uWeights.w * uSunlight * uCoronaFE.x * CORONA_GLOW * pow(rho, -F_CORONA_FALLOFF);
      col += uWeights.w * uGreen * uCoronaFE.y * CORONA_GLOW * exp(-h / E_CORONA_REACH) * (0.3 + streamers);
    }
  }

  /* Over each region that faces us or stands at the limb, in a band: the transition region's
     and loops' glow, and a flare's flash. True colour shows neither. */
  for (int k = 0; k < REGION_MAX; k++) {
    if (k >= uRegionCount || uLightMode != LIGHT_BAND) break;
    vec4 dir = uRegionDir[k];
    vec3 at = dir.xyz * (1.0 + 0.35 * LOOP_GLOW_REACH);
    /* The glow fades as the region turns away from us, never switching off at a step. */
    float facing = smoothstep(-0.2, 0.05, dot(normalize(o - at), dir.xyz));
    if (facing <= 0.0) continue;
    /* A soft ball about the region, read at the nearest point of the ray's visible run (from
       the camera to the disc, if it hits): a ray stopped short of the ball by the disc still
       takes the ball's tail, and the glow varies smoothly with where the disc cuts it. */
    vec3 toward = at - o;
    float along = clamp(dot(toward, d), 0.0, tEnd);
    float miss = length(toward - d * along);
    float reach = LOOP_GLOW_REACH * (0.5 + dir.w / LOOP_GLOW_REACH);
    float glow = facing * exp(-miss * miss / (reach * reach)) * uRegionSide[k].w;
    col += lit(LOOP_GLOW * glow, TRANSITION_K, LAYER_TRANSITION, uBalmer, uWeights.z);
    col += lit(LOOP_GLOW * glow, ACTIVE_K, LAYER_CORONA, uSunlight, uWeights.w);
    float flare = 1.0 - exp(-uRegionState[k].x);
    if (flare > 0.0) {
      vec3 site = dir.xyz - o;
      float t = max(dot(site, d), 0.0);
      float ds = length(site - d * t);
      float flash = flare * (exp(-ds * ds / (FLASH_REACH * FLASH_REACH * 0.08)) + 0.25 * exp(-ds / FLASH_REACH));
      col += lit(FLASH_GLARE * flash, FLARE_K, LAYER_FLARE, uSunlight, uFlareWeight);
    }
  }

  col += ejection(o, d, tEnd);
  if (max(col.r, max(col.g, col.b)) <= 0.0) discard;
  gl_FragColor = vec4(encodeSrgb(uGamut * col), 1.0);
}
