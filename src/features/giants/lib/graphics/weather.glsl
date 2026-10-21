// Light beyond a star's limb. Every star: the glow of a hot star's wind or a red supergiant's
// molecular shell and dust, and a pulsar's beams. The star in focus, alive (`activity.ts`):
// its corona with streamers over its active regions, its chromosphere and spicules,
// prominences (or a supergiant's plumes), the loops a flare leaves, ejections and the flash of
// a flare. Positions are in equatorial radii, the view's x right, y up and z towards us.

float wrapAngle(float a) {
  return a - TAU * floor((a + PI) / TAU);
}

// A hot star's wind, clumps streaming outwards: a steady wind's density falls as r⁻² and the
// light it gives (from density²) as r⁻⁴, so seen at a distance p from the centre, summed along
// the line of sight, it thins as p⁻³; it fades out by `ENVELOPE_REACH`, beyond which it is not
// drawn. A cool supergiant's molecular shell and dust, warm, lumpy and slowly turning. `i` is
// the star's disc, for its tints.
vec3 envelope(float r, vec2 dir, int style, float haze, int i, float seed) {
  float h = max(r - 1.0, 0.0);
  if (style == STYLE_RADIATIVE) {
    float clumps = 0.6 + 0.4 * gradientNoise3(vec3(dir * 7.0, log(r) * 10.0 - uTime * 0.3 + seed * 5.0));
    if (float(i) == uFocus.x && uFocus.y > 0.0) {
      float fine = resolvedFeature(28.0, uShape[i].z, 1.0);
      clumps += 0.12 * min(uFocus.y, 1.0) * fine * gradientNoise3(vec3(dir * 28.0, log(r) * 24.0 - uTime * 0.5 + seed));
    }
    float thin = pow(r, -3.0) * (1.0 - smoothstep(0.5 * ENVELOPE_REACH, ENVELOPE_REACH, r));
    return tintOf(i, TINT_FACE).rgb * WIND_GLOW * haze * clumps * thin;
  }
  float clumps = 0.5 + 0.5 * gradientNoise3(vec3(dir * 2.6, log(r) * 4.5 + seed * 7.0) + vec3(0.0, uTime * 0.02, uTime * 0.01));
  return tintOf(i, TINT_DUST).rgb * ENVELOPE_GLOW * haze * exp(-h * 3.0) * (0.25 + clumps * clumps);
}

// A pulsar's beams along its magnetic axis, swept round by its spin, fading out by
// `BEAM_REACH`; the flash as one points at us. `tint` is its face's light.
vec3 beams(vec2 o, float r, vec4 globe, vec3 tint) {
  vec3 m = toView(vec3(sin(PULSAR_TILT), cos(PULSAR_TILT), 0.0), globe.x, globe.y);
  float len = max(length(m.xy), 1e-3);
  vec2 axis = m.xy / len;
  float along = abs(dot(o, axis));
  float across = abs(o.x * axis.y - o.y * axis.x);
  float out1 = max(along - 1.0, 0.0);
  float width = 0.08 + 0.32 * out1;
  float beam = exp(-across * across / (width * width)) * smoothstep(0.9, 1.25, along) * exp(-out1 * 0.5 / len)
    * (1.0 - smoothstep(0.5 * BEAM_REACH, BEAM_REACH, r));
  float facing = pow(abs(m.z), 16.0) * exp(-max(r - 1.0, 0.0) * 2.5);
  return tint * BEAM_GLOW * (beam * len + facing);
}

// The corona: Baumbach's fall-off for the light scattered by its electrons, seen with the
// eye's compression; helmet streamers over the active regions at the limb, broad at the base
// and drawn into stalks above; fine rays and plumes at the poles.
vec3 corona(float r, vec2 dir, vec3 tint, float seed, vec4 globe) {
  float k = (0.0532 * pow(r, -2.5) + 1.425 * pow(r, -7.0) + 2.565 * pow(r, -17.0)) / 4.0432;
  float fall = pow(k, CORONA_CONTRAST);
  float streamers = 0.4;
  for (int j = 0; j < REGIONS; j++) {
    vec4 v = uRegionView[j];
    if (v.w <= 0.0) continue;
    float limb = exp(-v.z * v.z / 0.2);
    float apart = 1.0 - dot(dir, normalize(v.xy + vec2(1e-5)));
    float width = 0.006 + 0.05 / (r * r * r);
    streamers += 1.5 * v.w * limb * exp(-apart / width);
  }
  float rays = 0.82 + 0.18 * gradientNoise2(dir * 12.0 + vec2(seed * 7.0, uTime * 0.015));
  if (uDetail > 0.5) rays += 0.08 * gradientNoise2(dir * 40.0 + vec2(uTime * 0.02, seed * 3.0));
  vec3 axis = toView(vec3(0.0, 1.0, 0.0), globe.x, globe.y);
  float poles = exp(-(1.0 - abs(dot(dir, normalize(axis.xy + vec2(1e-5))))) / 0.06)
    * length(axis.xy) * (0.75 + 0.25 * gradientNoise2(dir * 60.0 + seed));
  return tint * CORONA * fall * (streamers + 0.3 * poles) * max(rays, 0.0);
}

// The chromosphere's thin pink rim and its spicules: a forest of jets round the limb, each
// rising and falling on its own. `h` is the height over the limb in radii.
vec3 chromosphere(float h, float phi, float radiusPx, float seed) {
  float px = 1.0 / (radiusPx * uPixelRatio);
  vec2 direction = vec2(cos(phi), sin(phi));
  float rim = exp(-h / (CHROMOSPHERE_HEIGHT + 0.5 * px)) * (0.75 + 0.25 * gradientNoise2(direction * 35.0 + seed));
  float jets = 0.0;
  float top = SPICULE_HEIGHT;
  if (h < top && uDetail > 0.5) {
    float columns = float(SPICULE_COLUMNS);
    float a = (phi / TAU + 0.5) * columns;
    vec3 dice = hash33(vec3(floor(a), seed * 13.0, 5.0));
    float reach = top * (0.3 + 0.7 * dice.x) * (0.6 + 0.4 * sin(uTime * (0.6 + 0.7 * dice.y) + TAU * dice.z));
    float thin = 1.0 - smoothstep(0.12, 0.42, abs(fract(a) - 0.5));
    float resolved = resolvedFeature(columns / TAU, radiusPx, 1.0);
    jets = resolved * thin * (1.0 - smoothstep(0.5 * reach, reach, h)) * (1.0 - 0.5 * h / top);
  }
  return uBalmer * CHROMOSPHERE * (rim + 0.35 * jets);
}

// Prominences (or a supergiant's plumes): sheets standing on the limb, each laid out by the
// activity model as columns at even position angles. Fine threads run up them and knots of
// plasma slide down; their tops are ragged.
vec3 sheets(float r, float phi, float radiusPx, vec3 own) {
  vec3 light = vec3(0.0);
  float px = 1.0 / (radiusPx * uPixelRatio);
  for (int k = 0; k < SHEETS; k++) {
    vec4 info = uSheetInfo[k];
    if (info.z <= 0.0) continue;
    float f = wrapAngle(phi - info.x) / info.y;
    if (f < 0.0 || f > float(SHEET_POINTS - 1)) continue;
    int i = min(int(f), SHEET_POINTS - 2);
    vec4 col = mix(uSheet[k * SHEET_POINTS + i], uSheet[k * SHEET_POINTS + i + 1], f - float(i));
    float height = col.y - 1.0;
    if (height <= 0.0 || r < 1.0 || r > col.y + 0.35 * height + 2.0 * px) continue;
    float up = (r - 1.0) / height;
    // Reference coordinates are fractions of a stellar radius. Zoom only filters them.
    float along = f * info.y * 200.0;
    float rise = (r - 1.0) * 200.0;
    float salt = float(k) * 7.31;
    /* A prominence: tongues of plasma of many heights, threaded with fine bright strands that
       lean and wave, knots sliding down them. A plume: a broad, lumpy cloud. */
    float grain = mix(1.0, 9.0, info.w);
    float lean = along + 0.25 * rise * gradientNoise2(vec2(along / 40.0, salt));
    float strand = 1.0 - abs(gradientNoise2(vec2(lean / (2.6 * grain), rise / 26.0 + uTime * 0.05 + salt)));
    float resolved = resolvedFeature(200.0 / (2.6 * grain), radiusPx, 1.0);
    float threads = mix(0.3, pow(strand, 5.0), resolved);
    if (uDetail > 0.5) {
      float strand2 = 1.0 - abs(gradientNoise2(vec2(lean / (1.3 * grain), rise / 14.0 - uTime * 0.04 + salt + 3.0)));
      threads += 0.6 * resolvedFeature(200.0 / (1.3 * grain), radiusPx, 1.0) * pow(strand2, 7.0);
    }
    float knots = 0.5 + 0.5 * gradientNoise2(vec2(along / (7.0 * grain), rise / (7.0 * grain) + uTime * mix(0.6, 0.05, info.w) + salt));
    float tongues = 0.8 + 0.4 * gradientNoise2(vec2(along / (22.0 * grain), uTime * 0.06 + salt))
      + 0.2 * gradientNoise2(vec2(along / (7.0 * grain), uTime * 0.11 + salt + 9.0));
    float u = up / max(tongues, 0.15);
    float shape = mix((1.0 - smoothstep(0.55, 1.0, u)) * exp(-0.8 * u), exp(-2.5 * u * u), info.w);
    /* Its underside: the surface for a hedgerow, a soft edge for an arch's hollow. */
    float body = shape * smoothstep(col.x - px, col.x + max(2.0 * px, 0.12 * height * col.w), r);
    float density = body * mix(mix(0.15, 1.6, threads), 1.0, info.w * 0.7) * mix(0.45, 1.35, knots);
    light += mix(uBalmer, own, info.w) * PROMINENCE * info.z * density;
  }
  return light;
}

// The loops a flare leaves: arches of hot plasma over its region, each a bundle of fine
// threads, with knots of cooling plasma raining down their legs; hidden where they pass behind
// the star.
vec3 loops(vec2 o, float r, float radiusPx, float frontDepth) {
  vec3 light = vec3(0.0);
  float px = 1.0 / (radiusPx * uPixelRatio);
  for (int k = 0; k < LOOPS; k++) {
    vec4 bound = uLoopBound[k];
    if (bound.w <= 0.0 || length(o - bound.xy) > bound.z) continue;
    float best = 1e4;
    float depth = 0.0;
    float along = 0.0;
    float width = 0.0;
    for (int j = 0; j < LOOP_POINTS - 1; j++) {
      vec4 a = uLoop[k * LOOP_POINTS + j];
      vec4 b = uLoop[k * LOOP_POINTS + j + 1];
      vec2 ab = b.xy - a.xy;
      float t = clamp(dot(o - a.xy, ab) / max(dot(ab, ab), 1e-8), 0.0, 1.0);
      float d = length(o - a.xy - ab * t);
      if (d < best) {
        best = d;
        depth = mix(a.z, b.z, t);
        along = (float(j) + t) / float(LOOP_POINTS - 1);
        width = a.w;
      }
    }
    // The entire front photosphere occludes a loop, including its near hemisphere.
    // Checking depth < 0 alone wrongly let loops shine through the body.
    if (depth + width < frontDepth) continue;
    float w = max(width, 1.5 * px);
    float x = best / max(width, 1e-5);
    float salt = float(k) * 5.3;
    float bundle = exp(-best * best / (w * w)) * min(1.0, width / w);
    float resolved = resolvedFeature(2.2 / max(width, 1e-5), radiusPx, 1.0);
    float threads = mix(0.65, 0.25 + pow(1.0 - abs(gradientNoise2(vec2(along * 3.0 + salt, x * 2.2))), 4.0), resolved);
    /* Rain: knots sliding from the top down both legs. */
    float fall = abs(along - 0.5);
    float rain = 0.6 + 0.6 * max(0.0, gradientNoise2(vec2(fall * 16.0 - uTime * 0.8, salt)));
    float share = 0.6 + 0.4 * hash33(vec3(salt, 1.0, 2.0)).x;
    light += mix(uBalmer, vec3(1.0, 0.82, 0.7), 0.35) * LOOP_GLOW * bound.w * bundle * threads * rain * share;
  }
  return light;
}

// Ejections, as a coronagraph sees one leave the limb: a bright curved front where it piles
// up the corona ahead of it, a darker cavity behind, the erupted prominence glowing pink at its
// heart, all threaded with the field that carries them. It thins as it spreads.
vec3 ejections(vec2 o, float r, vec3 tint, float seed) {
  vec3 light = vec3(0.0);
  for (int k = 0; k < EJECTIONS; k++) {
    vec4 e = uEjection[k];
    if (e.w <= 0.0 || r < 1.0) continue;
    vec2 dir = vec2(cos(e.x), sin(e.x));
    if (dot(o, dir) < r * cos(min(1.2 * e.z, PI))) continue;
    /* The angle from its axis, in shares of its spread. */
    float theta = atan(o.x * dir.y - o.y * dir.x, dot(o, dir));
    float w = theta / e.z;
    if (abs(w) > 1.2) continue;
    float extent = e.y - 1.0;
    /* The front's outline: out along its axis, falling back to the limb at its flanks. */
    float front = 1.0 + extent * sqrt(max(1.0 - w * w, 0.0));
    float thick = 0.05 + 0.2 * extent;
    float x = (r - front) / thick;
    float shell = x > 0.0 ? exp(-8.0 * x * x) : exp(-0.7 * x * x);
    float flanks = 1.0 - smoothstep(0.55, 1.15, abs(w));
    float cavity = 0.12 * (1.0 - smoothstep(front - thick, front, r)) * smoothstep(1.0, 1.0 + 0.3 * extent, r);
    float salt = seed * 11.0 + float(k) * 5.0;
    /* Loops of field draped round the front, and finer threads along them. */
    float strands = 0.5 + 0.5 * gradientNoise2(vec2(w * 6.0 + salt, (r - front) * 4.0 / thick));
    if (uDetail > 0.5) strands *= 0.6 + 0.4 * (1.0 - abs(gradientNoise2(vec2(w * 18.0 - salt, r * 1.5))));
    float heart = 1.0 + 0.45 * extent;
    float size = 0.04 + 0.1 * extent;
    vec2 off = vec2(r - heart, theta * r) / size;
    float core = exp(-dot(off, off)) * (0.6 + 0.4 * gradientNoise2(off * 1.7 + salt));
    float limb = smoothstep(1.0, 1.04, r);
    light += (tint * (shell * mix(0.35, 1.5, strands) + cavity) * flanks + uBalmer * core * 1.4)
      * EJECTION_GLOW * e.w * limb / sqrt(e.y);
  }
  return light;
}

// The glare of each flare lit, round its site while that faces us.
vec3 flash(vec2 o) {
  vec3 light = vec3(0.0);
  for (int k = 0; k < ARCADES; k++) {
    vec4 site = uFlash[k];
    if (site.w <= 0.0) continue;
    float facing = smoothstep(-0.12, 0.15, site.z);
    float d = length(o - site.xy);
    light += spectrumAt(FLARE_K).rgb * FLASH_GLARE * site.w * facing * (exp(-d * 16.0) + 0.25 * exp(-d * 3.5));
  }
  return light;
}
