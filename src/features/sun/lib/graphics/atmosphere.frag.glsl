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
uniform float uCmePresence;            // illustrative envelope visibility, independent of radius
uniform vec3 uCurrentSheet;            // bottom and top heights, R; reconnection rate
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
  if (front <= 1.0 || uCmePresence <= 0.0) return vec3(0.0);
  float thick = CME_THICKNESS * front;
  float t0;
  float t1;
  if (!raySphere(o, d, front + thick, t0, t1)) return vec3(0.0);
  float begin = max(t0, 0.0);
  float end = min(t1, tEnd);
  vec3 axis = uEruption.xyz;
  float spread = uEruptionShape.x;
  // Bound the one-sided ejection as well as its Sun-centred shell. Marching
  // empty space behind it wastes samples and leaves grain across the front.
  float outer = front + thick;
  float halfSpan = outer * 0.5;
  float width = outer * sin(min(spread * 1.15, PI * 0.5));
  float bound = length(vec2(halfSpan, width));
  if (!raySphere(o - axis * halfSpan, d, bound, t0, t1)) return vec3(0.0);
  begin = max(begin, t0);
  end = min(end, t1);
  if (end <= begin) return vec3(0.0);
  float step = (end - begin) / float(uSamples);
  float jitter = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
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
    float heart = 1.0 + uEruptionShape.z;
    vec3 off = (x - axis * heart) / max(front - heart, 1e-4);
    core += exp(-dot(off, off));
    t += step;
  }
  float scale = step * CME_GLOW * uEruptionShape.w * uCmePresence / sqrt(front);
  return lit(shell * scale, CORONA_K, LAYER_CORONA, uSunlight, uWeights.w)
    + lit(core * scale * 1.4, CHROMOSPHERE_K, LAYER_CHROMOSPHERE, uBalmer, uWeights.y);
}

// The hot plasma surrounding the current sheet, not a pair of broken magnetic lines.
// Its visible spine lies between the model's sheet tips and dims with reconnection.
vec3 currentSheet(vec3 o, vec3 d, float tEnd) {
  float bottom = 1.0 + uCurrentSheet.x;
  float top = 1.0 + uCurrentSheet.y;
  float length = top - bottom;
  if (length <= 1e-5 || uCurrentSheet.z <= 0.0) return vec3(0.0);
  vec3 axis = uEruption.xyz;
  float a = dot(o, axis);
  float b = dot(d, axis);
  float sin2 = max(1.0 - b * b, 1e-6);
  float t = (b * a - dot(o, d)) / sin2;
  float height = clamp(a + b * t, bottom, top);
  t = dot(axis * height - o, d);
  if (t <= 0.0 || t >= tEnd) return vec3(0.0);
  vec3 off = o + t * d - axis * height;
  float width = max(CURRENT_SHEET_WIDTH_R, uPixelWorld * t);
  float tips = smoothstep(bottom, bottom + 0.1 * length, height)
    * (1.0 - smoothstep(top - 0.1 * length, top, height));
  float emission = exp(-dot(off, off) / (width * width)) * tips * uCurrentSheet.z
    * uEruptionShape.w * min(4.0, inversesqrt(sin2));
  return lit(emission, FLARE_K, LAYER_FLARE, uSunlight, uFlareWeight);
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
      float height = h / SPICULE_HEIGHT;
      float filterWidth = max(length(fwidth(a)), 0.05);
      // Jittered roots, tilted threads and independent lifetimes remove the
      // dotted latitude grid. Neighbouring cells let a jet lean across its cell.
      for (int ix = -1; ix <= 1; ix++) {
        for (int iy = -1; iy <= 1; iy++) {
          vec2 cell = floor(a) + vec2(float(ix), float(iy));
          vec3 dice = hash33(vec3(cell, 5.0));
          float life = 0.5 + 0.5 * sin(uSpiculeClock * TWO_PI * (0.6 + 0.7 * dice.y) + TWO_PI * dice.z);
          float reach = (0.25 + 0.75 * dice.x) * (0.35 + 0.65 * life);
          vec2 root = cell + 0.2 + 0.6 * dice.xy;
          vec2 lean = (dice.yz - 0.5) * height * 0.8;
          vec2 off = a - root - lean;
          float width = 0.09 + 0.04 * dice.z;
          float filtered = width * width + filterWidth * filterWidth;
          float thread = exp(-dot(off, off) / filtered) * width * width / filtered;
          jets += thread * (1.0 - smoothstep(reach * 0.55, reach, height)) * sqrt(life);
        }
      }
      jets *= 3.0 * seen;
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
      float skirt = exp(-apart / width);
      float stalk = exp(-apart / (width * 0.18));
      streamers += STREAMER_GLOW * sqrt(edgeOn) * (0.55 * skirt + 0.65 * stalk) * tail;
    }
    // The projected radial direction is constant along a ray on the image.
    // qhat alone changes with impact radius for a nearby camera, turning
    // radial striae into a mottled two-dimensional carpet at the limb.
    vec3 skyRadial = normalize(qhat - axisOfView * dot(qhat, axisOfView));
    vec3 rayCoordinate = skyRadial * RAY_COUNT + vec3(log(rho) * 0.7, uClock.y * 0.025, 0.0);
    float rays = 1.0 - RAY_SHARE * abs(gradientNoise3(rayCoordinate));
    float rayDetail = resolvedFeature(RAY_COUNT * 4.0, px / max(rho, 1.0), 1.0);
    rays *= mix(1.0, 0.45 + 0.85 * pow(1.0 - abs(gradientNoise3(rayCoordinate * 4.0)), 3.0), rayDetail);
    if (uLightMode == LIGHT_BAND) rays = mix(1.0, rays, 0.25);
    float plumes = pow(1.0 - abs(gradientNoise3(skyRadial * PLUME_COUNT)), 3.0);
    float open = openness(qhat, uDipole);
    float innerReach = uLightMode == LIGHT_BAND ? min(INNER_CORONA_REACH, EUV_SCALE_HEIGHT_R) : INNER_CORONA_REACH;
    float inner = INNER_CORONA_GLOW * exp(-h / innerReach);
    float coronaGain = CORONA_GLOW * (uLightMode == LIGHT_BAND ? 0.45 : 1.0);
    /* The closed corona at the quiet corona's temperature; the holes' thin plasma cooler and
       fainter, with the plumes; the streamers' cores over the regions hotter. */
    float closed = coronaGain * (fall * (CORONA_FLOOR + inner) + inner) * rays * (1.0 - open * HOLE_DEPTH);
    float hole = coronaGain * fall * (HOLE_FLOOR + PLUME_GLOW * plumes) * rays * open * HOLE_DEPTH;
    float hot = coronaGain * fall * (streamers - CORONA_FLOOR) * rays * (1.0 - open * HOLE_DEPTH);
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
  col += currentSheet(o, d, tEnd);
  if (max(col.r, max(col.g, col.b)) <= 0.0) discard;
  gl_FragColor = vec4(encodeSrgb(uGamut * col), 1.0);
}
