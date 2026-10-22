// The Sun on its proxy sphere, ray-traced per pixel: the photosphere (granulation, the
// supergranular network and its fibrils, spot groups with their penumbral filaments, Evershed
// ripple, pores and umbral dots, faculae towards the limb, flare ribbons, the filaments where
// prominences stand), in its Planck colour under Claret limb darkening in white light, or each
// component's temperature through the band's response and ramp, or its radial field as a
// magnetogram; and where the wedge is cut, the faces: the shells from the core to the
// convection zone, each with its own light and motion, turning at its own rate so the
// tachocline's shear shows, shaded by depth so the wedge has volume. The hit's depth is
// written, so ribbons and volumes test against it.
precision highp float;

#include "./sun-common.glsl"
#include "../../../../space/sun/graphics/shaders/continuum.glsl"
#include "../../../../space/sun/graphics/shaders/granulation.glsl"
#include "../../../../space/sun/graphics/shaders/spots.glsl"
#include <horizon/temperature>
#include <horizon/display>

uniform highp sampler2D uProfile;      // R,V,B limb darkening by μ (the Sun's Claret law)
uniform highp sampler2D uInterior;     // by radius: ln T, ln ρ
uniform float uCoreLnT;                // ln T at the centre
uniform vec3 uLayers;                  // the core's, the tachocline's and the photosphere's radii
uniform float uFaceLogY;               // the face's reference log radiance (the continuum at PHOTOSPHERE_K)
uniform float uFine;                   // 1: granules, filaments, dots and threads at their own scale
uniform int uPlumeOctaves;
uniform float uEvershed;               // radii the Evershed flow has travelled
uniform float uPlumeRise;              // radii the plumes have risen
uniform int uRegionCount;
uniform vec4 uRegionDir[REGION_MAX];   // centre (body frame); angular radius
uniform vec4 uRegionAxis[REGION_MAX];  // leader→follower axis; polarity
uniform vec4 uRegionSide[REGION_MAX];  // across the axis (along the neutral line); strength
uniform vec4 uRegionState[REGION_MAX]; // flare; facula; the ribbons' half-separation; seed
uniform int uProminenceCount;
uniform vec4 uProminence[PROMINENCE_MAX];      // the channel's middle (body frame); half-length, radii
uniform vec4 uProminenceAlong[PROMINENCE_MAX]; // along the channel; visibility
uniform float uDipole;
uniform float uGrid;
uniform sampler2D uMap;                // SDO/HMI's flattened continuum (linear on sampling)
uniform float uMapShown;               // 0 until it arrives, 1 once faded in
uniform float uMapTexels;              // its texels per radian
uniform vec3 uSunlight;                // the photosphere's continuum colour: the white the eye adapts to
uniform vec3 uMagPositive;             // the magnetogram's poles, linear
uniform vec3 uMagNegative;
uniform mat4 uViewProjection;          // the camera's, for the hit's depth
varying vec3 vWorld;

// What a point of the face is: its temperature, how much of it a spot covers, its plage, the
// chromosphere's network there, a filament's shadow, its flare ribbons' light and its radial field.
struct Face {
  float kelvin;
  /** The measured continuum here, against the quiet Sun, and how much of the face it paints. */
  float measured;
  float mapShare;
  float spot;
  float plage;
  float network;
  float filament;
  float ribbon;
  float radial;
};

Face faceAt(vec3 s, float mu, float px) {
  Face f = Face(PHOTOSPHERE_K, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
  float dT = 0.0;
  /* The pattern's frame: in the body frame the equator stands still and each latitude lags
     behind it by what the law takes off its rate. */
  vec3 b = turned(s, uTurn * (1.0 - surfaceTurnRatio(s.y)));
  float fine = uFine * resolvedFeature(GRANULES_PER_RADIUS, px, mu);
  /* The measured Sun paints the face until its texels show; then the procedural surface takes
     over. The map is an observation at its epoch, in Carrington longitude (u, east increasing):
     the body's longitude zero is the epoch's central meridian, MAP_CENTRAL_MERIDIAN_RAD along
     it (the model's `mapUv`), and it turns rigidly with the equator, so its spots and the
     model's regions read off them stay together. In white light nothing invented sits on it:
     the model's spot and facula marks fade out where the map paints. */
  float texelPx = max(mu, 0.02) / (uMapTexels * max(px, 1e-9));
  f.mapShare = uMapShown * (1.0 - smoothstep(MAP_FADE_FROM_PX, MAP_FADE_TO_PX, texelPx));
  if (f.mapShare > 0.0) {
    /* The body's longitude of s (west positive: −z), then Carrington's. */
    vec2 uv = vec2(fract((atan(-s.z, s.x) + MAP_CENTRAL_MERIDIAN_RAD) / TWO_PI), 0.5 + asin(clamp(s.y, -1.0, 1.0)) / PI);
    f.measured = texture2D(uMap, uv).r / SUN_MAP_QUIET_INTENSITY;
  }
  float marks = uLightMode == LIGHT_WHITE ? 1.0 - f.mapShare : 1.0;
  float cells = GRANULES_PER_RADIUS / NETWORK_GRANULES;
  float netSeen = resolvedFeature(cells, px, mu);
  /* The supergranular network: its lanes bright, the cells' middles quiet. */
  float lanes = gradientNoise3(b * cells + vec3(0.0, uClock.y, 0.0));
  float network = 1.0 - smoothstep(0.0, 0.3, abs(lanes));
  /* The chromosphere's fibrils: mottle finer than the network and drawn out along it, where it resolves. */
  float fibrilSeen = resolvedFeature(cells * FIBRIL_SCALE, px, mu);
  if (fibrilSeen > 0.0) {
    vec3 stretched = b * cells * FIBRIL_SCALE * vec3(1.0, 0.35, 1.0) + vec3(uClock.y * 3.0, 0.0, 0.0);
    float fibrils = 1.0 - abs(gradientNoise3(stretched));
    network = mix(network, network * (1.0 - FIBRIL_SHARE) + FIBRIL_SHARE * fibrils * fibrils, fibrilSeen);
  }
  /* The magnetogram's salt and pepper: small bipoles in the network's lanes. */
  float grain = gradientNoise3(b * cells * 2.7 + vec3(0.0, 0.0, uClock.y));
  float pepper = sign(grain) * smoothstep(0.25, 0.55, abs(grain)) * (0.4 + 0.6 * network);
  f.radial += MAGNETOGRAM_PEPPER * MAGNETOGRAM_SATURATION * pepper * netSeen;
  float umbra = 0.0;
  float penumbra = 0.0;
  float filaments = 0.0;
  float pores = 0.0;
  float ripple = 0.0;
  float dots = 0.0;
  for (int k = 0; k < REGION_MAX; k++) {
    if (k >= uRegionCount) break;
    vec4 dir = uRegionDir[k];
    float reach = 2.2 * dir.w;
    if (1.0 - dot(s, dir.xyz) > 0.5 * reach * reach) continue;
    vec4 axis = uRegionAxis[k];
    vec4 side = uRegionSide[k];
    vec4 state = uRegionState[k];
    vec2 l = vec2(dot(s, axis.xyz), dot(s, side.xyz)) / dir.w;
    float seed = state.w;
    float grown = sqrt(side.w);
    float p = plage(l, seed) * state.y * side.w;
    f.plage = max(f.plage, p);
    dT += FACULA_CONTRAST * p * (0.15 + 0.85 * (1.0 - mu)) * marks;
    /* The region's radius in pixels: what its filaments and dots resolve at. */
    float footprint = dir.w * mu / px;
    float leadRadius = LEAD_SPOT * grown;
    float followRadius = FOLLOW_SPOT * grown;
    vec2 leadAt = l - vec2(0.42, 0.0);
    vec2 followAt = l - vec2(-0.46, 0.07);
    vec3 lead = spot(leadAt, leadRadius, seed, 2.0 * uFine, footprint * leadRadius);
    vec3 follow = spot(followAt, followRadius, seed + 7.3, 2.0 * uFine, footprint * followRadius);
    vec2 porous = l - vec2(-0.25, -0.05);
    float pore = smoothstep(0.5, 0.72, gradientNoise2(l * 7.5 + seed * 1.9)) * exp(-dot(porous, porous) / 0.14) * grown;
    umbra = max(umbra, max(lead.x, follow.x) * marks);
    penumbra = max(penumbra, max(lead.y, follow.y) * marks);
    filaments = max(filaments, lead.y > follow.y ? lead.z : follow.z);
    pores = max(pores, pore * marks);
    /* The Evershed flow: the penumbral filaments' grain streams outward from the umbra. */
    if (lead.y > 0.0 && uFine > 0.0) {
      float along = length(leadAt) / max(leadRadius * dir.w, 1e-5);
      float travelled = uEvershed / max(leadRadius * dir.w, 1e-5);
      float seen = resolvedFeature(EVERSHED_WAVES / (leadRadius * dir.w), px, mu);
      ripple = max(ripple, seen * lead.y * sin((along - travelled) * EVERSHED_WAVES));
      /* Umbral dots: specks of convection breaking through the umbra. */
      float dotSeen = resolvedFeature(UMBRAL_DOTS / (leadRadius * dir.w), px, mu);
      dots = max(dots, dotSeen * lead.x * smoothstep(0.35, 0.6, gradientNoise2(leadAt / leadRadius * UMBRAL_DOTS + uClock.x * 0.2 + seed)));
    }
    /* A flare's ribbons astride the neutral line, knotted, and the kernel between them. */
    if (state.x > 0.0) {
      /* The flare's light saturates softly: an X-class ribbon is bright, not a white frame. */
      float flaring = 1.0 - exp(-state.x);
      float bend = 0.08 * sin(l.y * 3.0 + seed * 4.0);
      float a = (l.x - state.z - bend) / RIBBON_SPREAD;
      float c = (l.x + state.z - bend) / RIBBON_SPREAD;
      float extent = 1.0 - smoothstep(0.25, 0.8, abs(l.y));
      float knots = max(0.0, 0.45 + 0.75 * gradientNoise2(vec2(l.y * 9.0, seed + uClock.x * 0.3)));
      f.ribbon += flaring * ((exp(-a * a) + exp(-c * c)) * extent * knots + 1.2 * exp(-dot(l, l) / 0.03));
    }
    /* The radial field: the leader's and follower's opposite poles. */
    f.radial += 2.0 * axis.w * side.w * (exp(-dot(leadAt, leadAt) / MAGNETOGRAM_POLE) - exp(-dot(followAt, followAt) / (0.8 * MAGNETOGRAM_POLE)));
  }
  /* Filaments: the prominences seen against the disc, dark ribbons along their channels. */
  for (int k = 0; k < PROMINENCE_MAX; k++) {
    if (k >= uProminenceCount) break;
    vec4 at = uProminence[k];
    vec4 along = uProminenceAlong[k];
    if (along.w <= 0.0 || 1.0 - dot(s, at.xyz) > 0.5 * (at.w + FILAMENT_WIDTH) * (at.w + FILAMENT_WIDTH)) continue;
    vec3 offset = s - at.xyz;
    float u = dot(offset, along.xyz);
    float v = length(offset - along.xyz * u);
    float wander = FILAMENT_WIDTH * 0.6 * gradientNoise2(vec2(u / FILAMENT_WIDTH * 0.4, float(k)));
    float inside = (1.0 - smoothstep(0.5 * FILAMENT_WIDTH, FILAMENT_WIDTH, abs(v - wander))) * (1.0 - smoothstep(0.8 * at.w, at.w, abs(u)));
    f.filament = max(f.filament, inside * along.w);
  }
  f.spot = max(penumbra, pores);
  float quiet = mix(0.35, 1.0, mu) * (1.0 - f.spot);
  if (fine > 0.0) {
    vec3 granules = granuleField(b * GRANULES_PER_RADIUS, uClock.x, fine);
    dT += GRANULE_CONTRAST * fine * quiet * granules.x;
  }
  /* Where the granules are too small to see, the network's faint mottle shows instead. */
  dT += NETWORK_CONTRAST * netSeen * (1.0 - fine) * (network - 0.4) * quiet;
  f.kelvin = PHOTOSPHERE_K * (1.0 + dT);
  float penOnly = max(penumbra - umbra, 0.0);
  f.kelvin = mix(f.kelvin, PENUMBRA_K * (1.0 + PENUMBRA_FILAMENT * (filaments - 0.5) + EVERSHED_RIPPLE * ripple), penOnly);
  f.kelvin = mix(f.kelvin, UMBRA_K * (1.0 + UMBRAL_DOT_CONTRAST * dots), umbra);
  f.kelvin = mix(f.kelvin, UMBRA_K, 0.7 * pores * (1.0 - penumbra));
  f.network = network * netSeen;
  return f;
}

// The surface's colour in the current light.
vec3 surfaceColour(Face f, vec3 s, float mu) {
  vec3 limb = sample1D(uProfile, mu, PROFILE_SAMPLES).rgb;
  if (uLightMode == LIGHT_MAGNETOGRAM) {
    float field = (f.radial + uDipole * MAGNETOGRAM_DIPOLE * s.y) * mu;
    float g = tanh(field / MAGNETOGRAM_SATURATION);
    return g < 0.0
      ? mix(vec3(MAGNETOGRAM_GREY), uMagNegative, -g)
      : mix(vec3(MAGNETOGRAM_GREY), uMagPositive, g);
  }
  if (uLightMode == LIGHT_ECLIPSE) return vec3(0.0);
  if (uLightMode == LIGHT_WHITE) {
    /* The disc as the eye adapted to sunlight sees it: the photosphere's continuum is white by
       definition and cooler gas warmer against it; the measured continuum under the Claret law
       where the map resolves, the procedural face where it does not; relative light raised to
       the display contrast, then exposed below white at the centre. */
    vec3 procedural = glowAt(f.kelvin, uFaceLogY) / uSunlight;
    vec3 measured = vec3(f.measured);
    vec3 relative = mix(procedural, measured, f.mapShare) * limb;
    vec3 light = pow(max(relative, 0.0), vec3(SURFACE_CONTRAST)) * SURFACE_EXPOSURE;
    /* A white-light flare is rare and faint: only as much as the light's flare weight allows (none). */
    return light + glowAt(WHITE_FLARE_K, uFaceLogY) / uSunlight * RIBBON_GLARE * f.ribbon * uFlareWeight;
  }
  /* A band: each layer's pattern on the disc, through the band's response to the layer's
     temperatures and the layer's weight, exposed to the band's scale. The photosphere is its
     continuum; the chromosphere the network and plage, dark under filaments and spots; the
     transition region the network's feet, the plage's moss and the flare's ribbons; the
     corona over the disc the quiet glow (dark in the holes), the active regions' loops over
     the plage and the ribbons' tops; the flare's plasma the ribbons. */
  float warm = f.kelvin / PHOTOSPHERE_K;
  float photosphere = layerResponse(log(f.kelvin), LAYER_PHOTOSPHERE) * warm * warm * warm * warm * limb.g;
  float plage = BAND_PLAGE * f.plage;
  float chromosphere = layerResponse(log(CHROMOSPHERE_K), LAYER_CHROMOSPHERE)
    * (BAND_QUIET + BAND_NETWORK * f.network + plage)
    * (0.7 + 0.3 * (1.0 - mu)) * (1.0 - 0.6 * f.spot) * (1.0 - FILAMENT_DEPTH * f.filament);
  float transition = layerResponse(log(TRANSITION_K), LAYER_TRANSITION)
    * (0.5 * BAND_QUIET + 0.5 * BAND_NETWORK * f.network + plage + BAND_RIBBON * f.ribbon);
  float open = openness(s, uDipole);
  float quiet = layerResponse(log(CORONA_K), LAYER_CORONA) * BAND_QUIET * (1.0 - HOLE_DEPTH * open)
    + layerResponse(log(HOLE_K), LAYER_CORONA) * BAND_QUIET * HOLE_FLOOR * open;
  float loops = layerResponse(log(ACTIVE_K), LAYER_CORONA) * (2.0 * plage + 0.5 * BAND_RIBBON * f.ribbon);
  float flare = layerResponse(log(FLARE_K), LAYER_FLARE) * f.ribbon;
  float intensity = dot(uWeights, vec4(photosphere, chromosphere, transition, quiet + loops)) + uFlareWeight * flare;
  return rampAt(uBandScale * intensity);
}

// The latitude grid on the surface: thin gold lines every GRID_STEP, a pixel wide.
float gridLine(vec3 s, float mu, float px) {
  float lat = asin(clamp(s.y, -1.0, 1.0));
  float lon = atan(s.z, s.x);
  float width = px / max(mu, 0.05);
  float dLat = abs(lat - GRID_STEP * floor(lat / GRID_STEP + 0.5));
  float dLon = abs(lon - GRID_STEP * floor(lon / GRID_STEP + 0.5)) * cos(lat);
  return max(1.0 - smoothstep(0.0, width, dLat), 1.0 - smoothstep(0.0, width, dLon));
}

// A cut face at `p`: the shell there, with its own light, colour and motion; shaded by depth;
// gold rims on the shells' bounds.
vec3 faceColour(vec3 p, float px, int face) {
  float r = length(p);
  vec3 dir = p / max(r, 1e-5);
  float lnT = sample1D(uInterior, r / uLayers.z, INTERIOR_SAMPLES).x;
  float shimmer = 1.0;
  float displayK;
  float light;
  if (r < uLayers.x) {
    /* The core: fusion's flicker. */
    shimmer += CORE_SHIMMER * gradientNoise3(p * CORE_CELLS + vec3(uClock.z, 0.37 * uClock.z, 0.0));
    displayK = CORE_DISPLAY_K;
    light = CORE_LIGHT;
  } else if (r < uLayers.y) {
    /* The radiative zone: a smooth golden gradient, turning rigidly, its diffusion a slow shimmer. */
    vec3 q = turned(p, uTurn * (1.0 - INTERIOR_TURN_RATIO));
    shimmer += RADIATIVE_SHIMMER * gradientNoise3(q * RADIATIVE_CELLS + vec3(0.0, uClock.w, 0.0));
    float out1 = smoothstep(uLayers.x, uLayers.y, r);
    displayK = exp(mix(log(RADIATIVE_INNER_DISPLAY_K), log(RADIATIVE_OUTER_DISPLAY_K), out1));
    light = mix(RADIATIVE_INNER_LIGHT, RADIATIVE_OUTER_LIGHT, out1);
  } else {
    /* The convection zone: columns turning at the shell's own rate (rigid at the tachocline,
       the surface's law at the top, so the shear shows), with rising grain. */
    float rate = mix(INTERIOR_TURN_RATIO, surfaceTurnRatio(dir.y), smoothstep(uLayers.y, uLayers.z, r));
    vec3 q = turned(p, uTurn * (1.0 - rate));
    vec3 column = q / r;
    float lateral = 0.0;
    float amplitude = 1.0;
    float norm = 0.0;
    vec3 c = column * PLUME_COLUMNS;
    for (int o = 0; o < 8; o++) {
      if (o >= uPlumeOctaves) break;
      lateral += amplitude * gradientNoise3(c);
      norm += amplitude;
      c = c * 2.03 + 11.7;
      amplitude *= 0.5;
    }
    lateral /= max(norm, 1e-3);
    float rise = gradientNoise3(q * PLUME_GRAIN - column * uPlumeRise * PLUME_GRAIN);
    shimmer += PLUME_CONTRAST * (lateral + 0.6 * rise * (0.6 + lateral));
    /* Granules at the top, where they are resolved. */
    float top = 1.0 - smoothstep(0.0, PLUME_GRANULE_DEPTH, uLayers.z - r);
    float fine = uFine * top * resolvedFeature(GRANULES_PER_RADIUS, px, 1.0);
    if (fine > 0.0) shimmer += 3.0 * GRANULE_CONTRAST * fine * granuleField(q * GRANULES_PER_RADIUS, uClock.x, 1.0).x;
    displayK = CONVECTION_DISPLAY_K;
    light = CONVECTION_LIGHT;
  }
  /* Volume: the face's normal against a key light from the open side (yawed off the wedge's
     bisector and raised, so the two faces differ), over an ambient floor; and an occlusion
     darkening into the apex the faces meet at. */
  vec3 na;
  vec3 nb;
  wedgeNormals(na, nb);
  vec3 normal = face == 1 ? na : nb;
  float keyAzimuth = cutAzimuth() + KEY_YAW;
  vec3 key = normalize(vec3(cos(keyAzimuth), KEY_RISE, sin(keyAzimuth)));
  float lambert = KEY_AMBIENT + (1.0 - KEY_AMBIENT) * max(dot(normal, key), 0.0);
  float toAxis = length(p.xz) / max(r, 1e-5);
  float apex = 1.0 - APEX_DEPTH * (1.0 - smoothstep(0.0, APEX_REACH, toAxis));
  float shade = lambert * apex;
  float bright = light * max(shimmer, 0.0) * shade;
  vec3 col;
  if (uLightMode == LIGHT_BAND) {
    col = rampAt(uBandScale * INTERIOR_BAND_LIGHT * bandResponse(exp(lnT)) * bright);
  } else if (uLightMode == LIGHT_MAGNETOGRAM) {
    col = vec3(MAGNETOGRAM_GREY) * bright * 0.5;
  } else {
    col = blackbodyLinear(displayK) * bright;
  }
  float width = SHELL_RIM + px;
  float rim = 1.0 - smoothstep(0.0, width, abs(r - uLayers.x));
  /* The tachocline's rim catches the key light. */
  rim = max(rim, (1.0 - smoothstep(0.0, width, abs(r - uLayers.y))) * (1.0 + RIM_KEY * lambert));
  rim = max(rim, 1.0 - smoothstep(0.0, width, abs(r - uLayers.z)));
  return mix(col, uGold * (1.0 + RIM_KEY * lambert), clamp(SHELL_RIM_GOLD * rim, 0.0, 1.0));
}

void main() {
  /* Into the body frame: everything below is the Sun's own. */
  vec3 o = toBody(cameraPosition);
  vec3 d = toBody(normalize(vWorld - cameraPosition));
  vec3 p;
  int face;
  if (!traceSun(o, d, p, face)) discard;
  float px = uPixelWorld * distance(o, p);
  vec3 col;
  if (face == 0) {
    float mu = clamp(dot(p, -d), 0.0, 1.0);
    col = surfaceColour(faceAt(p, mu, px), p, mu);
    if (uGrid > 0.0) col = mix(col, uGold, GRID_ALPHA * uGrid * gridLine(p, mu, px));
  } else {
    col = uLightMode == LIGHT_ECLIPSE ? vec3(0.0) : faceColour(p, px, face);
  }
  vec4 clip = uViewProjection * vec4(turned(p, uTurn), 1.0);
  gl_FragDepth = clip.z / clip.w * 0.5 + 0.5;
  gl_FragColor = vec4(displayEncode(uGamut * col), 1.0);
}
