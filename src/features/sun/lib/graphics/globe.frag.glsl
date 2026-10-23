// The Sun on its proxy sphere, ray-traced per pixel: the photosphere (granulation, the
// supergranular network and its fibrils, spot groups with their penumbral filaments, Evershed
// ripple, pores and umbral dots, faculae towards the limb, flare ribbons, the filaments where
// prominences stand), in its Planck colour under Claret limb darkening in white light, or each
// component's temperature through the band's response and ramp, or its radial field as a
// magnetogram; and where the wedge is cut, the faces: Model S's temperature as a diagram's heat
// from the core to the convection zone, the light glowing where it is made, the diffusive
// interior's still grain, the tachocline's sliding laminae and convection cells that widen with
// depth, each shell turning at its own rate, shaded so the wedge has volume. The hit's depth is
// written, so ribbons and volumes test against it.
precision highp float;

#include "./sun-common.glsl"
#include "../../../../space/sun/graphics/shaders/continuum.glsl"
#include "../../../../space/sun/graphics/shaders/granulation.glsl"
#include "../../../../space/sun/graphics/shaders/spots.glsl"
#include <horizon/temperature>
#include <horizon/display>
#include "./surface-detail.glsl"

uniform highp sampler2D uProfile;      // R,V,B limb darkening by μ (the Sun's Claret law)
uniform highp sampler2D uInterior;     // by radius: ln T, ln ρ, the cells' octave, the light made (over its peak)
uniform float uCoreLnT;                // ln T at the centre
uniform vec3 uLayers;                  // the core's, the tachocline's and the photosphere's radii
uniform float uFaceLogY;               // the face's reference log radiance (the continuum at PHOTOSPHERE_K)
uniform float uFine;                   // 1: granules, filaments, dots and threads at their own scale
uniform vec4 uCellOctave[CONVECTION_OCTAVE_COUNT]; // cells per radius; the radius they are centred on; their clock
uniform float uEvershed;               // radii the Evershed flow has travelled
uniform int uRegionCount;
uniform vec4 uRegionDir[REGION_MAX];   // centre (body frame); angular radius
uniform vec4 uRegionAxis[REGION_MAX];  // leader→follower axis; polarity
uniform vec4 uRegionSide[REGION_MAX];  // across the axis (along the neutral line); strength
uniform vec4 uRegionState[REGION_MAX]; // flare; facula; the ribbons' half-separation; seed
uniform vec4 uRegionDonor[REGION_MAX];     // the photographed group it is drawn from: centre at the epoch (body frame); its spots' reach
uniform vec4 uRegionDonorAxis[REGION_MAX]; // that group's axis at the epoch; the patch's radians per the region's
uniform float uRegionPhoto[REGION_MAX];    // its spot area against its patch's, 0–1
uniform int uSeededCount;
uniform vec4 uSeeded[REGION_MAX];          // a seeded group where the photograph has it (body frame at the epoch); its spots' reach
uniform int uProminenceCount;
uniform vec4 uProminence[PROMINENCE_MAX];      // the channel's middle (body frame); half-length, radii
uniform vec4 uProminenceAlong[PROMINENCE_MAX]; // along the channel; visibility
uniform float uDipole;
uniform vec3 uDipoleMoment;            // the global dipole's moment, body frame: polar and equatorial
uniform float uGrid;
uniform sampler2D uMap;                // SDO/HMI's flattened continuum (linear on sampling)
uniform float uMapShown;               // 0 until it arrives, 1 once faded in
uniform float uMapUnclaimed;           // how much of the photograph's spots no region draws still shows
uniform vec3 uSunlight;                // the photosphere's continuum colour: the white the eye adapts to
uniform vec3 uPositive;                // the magnetogram's poles, linear
uniform vec3 uNegative;
uniform mat4 uViewProjection;          // the camera's, for the hit's depth
varying vec3 vWorld;

#include "./spot-stencil.glsl"

// A body-frame direction on the map: Carrington longitude over a turn (east increasing) and
// latitude from the south pole, as the model's `mapUv`.
vec2 mapUvOf(vec3 p) {
  return vec2(fract((atan(-p.z, p.x) + MAP_CENTRAL_MERIDIAN_RAD) / TWO_PI), 0.5 + asin(clamp(p.y, -1.0, 1.0)) / PI);
}

// The map's gradients over a pixel, from the surface point's (`dpdx`, `dpdy`), for the filter's
// level and anisotropy: worked out here, not from the map coordinates themselves, so the seam
// is no jump (no `fract`) and the longitudes' stretch, unbounded where they converge, stops
// counting at the latitude the photograph is flat from, where there is nothing finer to average.
vec4 mapGradientOf(vec3 p, vec3 dpdx, vec3 dpdy) {
  float rho = max(length(p.xz), 1e-5);
  vec3 east = vec3(p.z, 0.0, -p.x) / (TWO_PI * rho * max(rho, MAP_FLAT_LATITUDE_COS));
  float north = 1.0 / (PI * rho);
  return vec4(dot(east, dpdx), north * dpdx.y, dot(east, dpdy), north * dpdy.y);
}

// The photograph's continuum held within the quiet disc's range: its spots, faculae and their
// rims gone, its quiet texture kept.
float photoQuiet(float measured) {
  return clamp(measured, PHOTO_QUIET_LOW, PHOTO_QUIET_HIGH);
}

// How deep into a spot the photograph is here: 0 at the quiet disc's lower edge, 1 in an umbra.
float photoDepth(float measured) {
  return clamp((PHOTO_QUIET_LOW - measured) / PHOTO_DEPTH_RANGE, 0.0, 1.0);
}

// A step on the sphere about a region's centre carried onto its donor's patch: its parts along
// and across the region's axis become the same along and across the donor's, at the patch's scale.
vec3 carriedStep(vec3 step, vec3 axis, vec3 side, vec3 donorAxis, vec3 donorSide, float scale) {
  return scale * (dot(step, axis) * donorAxis + dot(step, side) * donorSide);
}

// The photograph at a point of the map: its continuum against the quiet Sun and how much a spot
// covers there, the close-up stencil blended in by `detail`; `grad` is the map's gradient here.
vec2 photographAt(vec3 p, vec4 grad, float px, float mu, float detail) {
  vec2 uv = mapUvOf(p);
  float measured = texture2DGradEXT(uMap, uv, grad.xy, grad.zw).r / SUN_MAP_QUIET_INTENSITY;
  float spot = 1.0 - smoothstep(0.6, 0.9, measured);
  if (detail > 0.0) {
    vec4 stencil = photographedSpot(uv, p, px, mu);
    measured = mix(measured, stencil.z, detail * stencil.w);
    spot = mix(spot, stencil.x, detail * stencil.w);
  }
  return vec2(measured, spot);
}

// What a point of the face is: its temperature, how much of it a spot covers, its plage, the
// chromosphere's network there, a filament's shadow, its flare ribbons' light and its radial field.
struct Face {
  float kelvin;
  /** The measured continuum here, against the quiet Sun, and how much of the face it paints. */
  float measured;
  float mapShare;
  /** The granulation's temperature here: the detail laid over the photograph, which holds none. */
  float granuleKelvin;
  float spot;
  float plage;
  float network;
  float filament;
  float ribbon;
  float radial;
};

// One generation of the quiet network at a point in cells: its lanes (1 on a lane), and its
// salt and pepper, small bipoles of either sign, stronger in the lanes.
vec2 quietNetwork(vec3 q) {
  float lanes = 1.0 - smoothstep(0.0, 0.3, abs(gradientNoise3(q)));
  float grain = gradientNoise3(q * 2.7);
  return vec2(lanes, sign(grain) * smoothstep(0.25, 0.55, abs(grain)) * (0.4 + 0.6 * lanes));
}

Face faceAt(vec3 s, vec3 dsdx, vec3 dsdy, float mu, float px) {
  Face f = Face(PHOTOSPHERE_K, 1.0, 0.0, PHOTOSPHERE_K, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
  float dT = 0.0;
  /* The pattern's frame: in the body frame the equator stands still and each latitude lags
     behind it by what the law takes off its rate. */
  vec3 b = turned(s, uTurn * (1.0 - surfaceTurnRatio(s.y)));
  float fine = uFine * resolvedFeature(GRANULES_PER_RADIUS, px, mu);
  /* The photograph is the disc at its epoch: SDO/HMI's continuum in Carrington longitude (u,
     east increasing), the body's longitude zero the epoch's central meridian
     (MAP_CENTRAL_MERIDIAN_RAD along it, the model's `mapUv`). Time carries it on as the model's
     weather goes: its quiet disc turns with the equator; every region draws its spots and faculae
     from a photographed patch (its own if it is a seeded group, its donor's otherwise), turning
     with its latitude at its size and strength; and the active features no region draws decay as
     the model says. Zoom adds fine detail; synthetic spot outlines remain the fallback for an
     unavailable map and the other spectral modes. */
  // One physical zoom threshold for all image tiers; changing quality cannot
  // change the morphology or make close-up detail jump in and out.
  float texelPx = max(mu, 0.02) / ((STENCIL_WIDTH / TWO_PI) * max(px, 1e-9));
  f.mapShare = uLightMode == LIGHT_WHITE ? uMapShown : 0.0;
  /* The close-up stencil sharpens the photograph's spots once its texels are magnified. */
  float mapDetail = uFine * smoothstep(MAP_DETAIL_FROM_PX, MAP_DETAIL_TO_PX, texelPx);
  /* The photograph here, its active features kept only where no region draws them, and the
     regions' patches over it, multiplied in. */
  vec2 photo = vec2(1.0, 0.0);
  float unclaimed = 0.0;
  float patches = 1.0;
  float patchSpot = 0.0;
  if (f.mapShare > 0.0) {
    photo = photographAt(s, mapGradientOf(s, dsdx, dsdy), px, mu, mapDetail * uStencilShown);
    unclaimed = uMapUnclaimed;
    for (int k = 0; k < REGION_MAX; k++) {
      if (k >= uSeededCount) break;
      vec4 group = uSeeded[k];
      unclaimed *= smoothstep(group.w, PHOTO_EDGE * group.w, length(s - group.xyz));
    }
  }
  float marks = uLightMode == LIGHT_WHITE ? 1.0 - f.mapShare : 1.0;
  float cells = GRANULES_PER_RADIUS / NETWORK_GRANULES;
  float netSeen = resolvedFeature(cells, px, mu);
  /* The supergranular network: its lanes bright, the cells' middles quiet. */
  /* The quiet network, supergranules and their small bipoles: each generation is carried by
     the differential rotation through its life, then renewed; two generations half a life apart
     crossfade, so the pattern never shears out along the latitudes. */
  vec2 renewed = vec2(0.0);
  float lag = (1.0 - surfaceTurnRatio(s.y)) * NETWORK_TURN_PER_LIFE;
  for (int k = 0; k < 2; k++) {
    float age = uClock.y + 0.5 * float(k);
    float generation = floor(age);
    float lived = age - generation;
    vec3 q = turned(s, lag * lived) * cells + NETWORK_GENERATION_SHIFT * mod(generation, NETWORK_GENERATIONS);
    renewed += (1.0 - abs(2.0 * lived - 1.0)) * quietNetwork(q);
  }
  float network = renewed.x;
  /* The chromosphere's fibrils: mottle finer than the network and drawn out along it, where it resolves. */
  if (uLightMode == LIGHT_BAND) network = chromosphericNetwork(b, cells, px, mu, uFine);
  /* The magnetogram's salt and pepper, of the quiet network's mean unsigned field. The global
     dipole's radial field (polar and equatorial parts) lives in it: elements of its sign
     strengthen and the others weaken by its share of that mean, so their mean is the dipole's
     field and the caps turn unipolar; any excess, and all of it where the network does not
     resolve, spreads evenly. */
  float pepper = renewed.y / MAGNETOGRAM_PEPPER_MEAN;
  float dipole = POLAR_FIELD_T * dot(s, uDipoleMoment);
  float unipolar = clamp(dipole / MAGNETOGRAM_NETWORK_T, -1.0, 1.0);
  float elements = MAGNETOGRAM_NETWORK_T * (pepper + unipolar * abs(pepper));
  f.radial += mix(dipole, elements + dipole - MAGNETOGRAM_NETWORK_T * unipolar, netSeen);
  float umbra = 0.0;
  float penumbra = 0.0;
  float filaments = 0.0;
  float pores = 0.0;
  float ripple = 0.0;
  float dots = 0.0;
  for (int k = 0; k < REGION_MAX; k++) {
    if (k >= uRegionCount) break;
    vec4 dir = uRegionDir[k];
    vec4 donor = uRegionDonor[k];
    vec4 donorAxis = uRegionDonorAxis[k];
    /* Its own reach, and its patch's: the donor's spots at the patch's scale. */
    float reach = max(REGION_REACH * dir.w, f.mapShare > 0.0 ? PHOTO_EDGE * donor.w / donorAxis.w : 0.0);
    if (1.0 - dot(s, dir.xyz) > 0.5 * reach * reach) continue;
    vec4 axis = uRegionAxis[k];
    vec4 side = uRegionSide[k];
    vec4 state = uRegionState[k];
    vec2 l = vec2(dot(s, axis.xyz), dot(s, side.xyz)) / dir.w;
    float growth = uRegionPhoto[k];
    if (f.mapShare > 0.0 && growth > 0.0) {
      /* Where this point stands from the region's centre, along its axis and across it, radians
         on the sphere, then as far from the donor's centre at the patch's scale. */
      vec2 across = l * dir.w;
      float sine = length(across);
      vec2 d = across * (atan(sine, dot(s, dir.xyz)) / max(sine, 1e-9)) * donorAxis.w;
      float far = length(d);
      float within = 1.0 - smoothstep(donor.w, PHOTO_EDGE * donor.w, far);
      if (within > 0.0) {
        vec3 donorSide = cross(donor.xyz, donorAxis.xyz);
        vec3 toward = d.x * donorAxis.xyz + d.y * donorSide;
        vec3 p = cos(far) * donor.xyz + (far > 0.0 ? sin(far) / far : 1.0) * toward;
        float detail = uFine * smoothstep(MAP_DETAIL_FROM_PX, MAP_DETAIL_TO_PX, texelPx / donorAxis.w) * uStencilShown;
        /* The pixel's footprint on the patch, as its steps: the map's gradient there. */
        vec4 grad = mapGradientOf(
          p,
          carriedStep(dsdx, axis.xyz, side.xyz, donorAxis.xyz, donorSide, donorAxis.w),
          carriedStep(dsdy, axis.xyz, side.xyz, donorAxis.xyz, donorSide, donorAxis.w)
        );
        vec2 sampled = photographAt(p, grad, px * donorAxis.w, mu, detail);
        /* The patch keeps its place and size; the region's spot area keeps only what lies deeper
           than its cut: a decaying group loses its pores and penumbral rims first and its spots
           retreat into their umbrae, a growing one comes from its darkest cores out. Its faculae
           outlast its spots. The whole patch shows at full growth: at the epoch, the photograph. */
        float ratio = sampled.x / photoQuiet(sampled.x);
        float cut = (1.0 - growth) * (1.0 + PHOTO_ERODE_SOFT) - PHOTO_ERODE_SOFT;
        float kept = ratio < 1.0
          ? smoothstep(cut, cut + PHOTO_ERODE_SOFT, photoDepth(sampled.x))
          : sqrt(growth);
        patches *= mix(1.0, ratio, within * kept);
        patchSpot = max(patchSpot, sampled.y * within * kept);
      }
    }
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
    vec3 lead = uFine > 0.0
      ? solarSpot(leadAt, leadRadius, seed, footprint * leadRadius)
      : spot(leadAt, leadRadius, seed, 0.0, footprint * leadRadius);
    vec3 follow = uFine > 0.0
      ? solarSpot(followAt, followRadius, seed + 7.3, footprint * followRadius)
      : spot(followAt, followRadius, seed + 7.3, 0.0, footprint * followRadius);
    vec2 porous = l - vec2(-0.25, -0.05);
    float pore = smoothstep(0.5, 0.72, gradientNoise2(l * 7.5 + seed * 1.9)) * exp(-dot(porous, porous) / 0.14) * grown;
    umbra = max(umbra, max(lead.x, follow.x) * marks);
    penumbra = max(penumbra, max(lead.y, follow.y) * marks);
    filaments = max(filaments, lead.y > follow.y ? lead.z : follow.z);
    pores = max(pores, pore * marks);
    /* The Evershed flow: the penumbral filaments' grain streams outward from the umbra. */
    if (lead.y > 0.0 && uFine > 0.0) {
      float seen = resolvedFeature(EVERSHED_WAVES / (leadRadius * dir.w), px, mu);
      ripple += seen * lead.y * penumbralFlow(leadAt, leadRadius, dir.w, uEvershed, seed);
    }
    /* Independent umbral dots in both spots, masked away from the penumbra. */
    if (uFine > 0.0 && lead.x > 0.0)
      dots = max(dots, lead.x * umbralDots(leadAt, leadRadius, seed, footprint * leadRadius, uClock.x));
    if (uFine > 0.0 && follow.x > 0.0)
      dots = max(dots, follow.x * umbralDots(followAt, followRadius, seed + 7.3, footprint * followRadius, uClock.x));
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
    /* The radial field: the leader's and follower's opposite poles, of equal flux, the
       follower's spread wider. */
    float followSpread = MAGNETOGRAM_FOLLOW_SPREAD * MAGNETOGRAM_POLE;
    f.radial += SPOT_FIELD_T * axis.w * side.w * (exp(-dot(leadAt, leadAt) / MAGNETOGRAM_POLE) - exp(-dot(followAt, followAt) / followSpread) / MAGNETOGRAM_FOLLOW_SPREAD);
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
  /* The photograph with the active features no region draws faded into its quiet disc as they
     decay, and the regions' carried onto it: at the epoch, exactly the photograph. */
  f.measured = mix(photoQuiet(photo.x), photo.x, unclaimed) * patches;
  float mappedSpot = max(photo.y * unclaimed, patchSpot) * f.mapShare;
  f.spot = max(max(penumbra, pores), mappedSpot);
  float quiet = mix(0.35, 1.0, mu) * (1.0 - f.spot);
  float granulation = 0.0;
  if (fine > 0.0) {
    vec3 granules = granuleField(b * GRANULES_PER_RADIUS, uClock.x, fine);
    granulation = GRANULE_CONTRAST * fine * quiet * (granules.x - 0.45 * granules.y);
  }
  /* Where the granules are too small to see, the network's faint mottle shows instead. */
  float mottle = NETWORK_CONTRAST * netSeen * (1.0 - fine) * (network - 0.4) * quiet;
  dT += granulation + mottle;
  f.granuleKelvin = PHOTOSPHERE_K * (1.0 + granulation);
  f.kelvin = PHOTOSPHERE_K * (1.0 + dT);
  float penOnly = max(penumbra - umbra, 0.0);
  f.kelvin = mix(f.kelvin, PENUMBRA_K * (1.0 + PENUMBRA_FILAMENT * (filaments - 0.5) + EVERSHED_RIPPLE * ripple), penOnly);
  f.kelvin = mix(f.kelvin, UMBRA_K * (1.0 + UMBRAL_DOT_CONTRAST * dots), umbra);
  f.kelvin = mix(f.kelvin, UMBRA_K, 0.7 * pores * (1.0 - penumbra));
  f.network = mix(0.36, network, netSeen);
  return f;
}

// The surface's colour in the current light.
vec3 surfaceColour(Face f, vec3 s, float mu) {
  vec3 limb = tableAt(uProfile, mu, PROFILE_SAMPLES, 0, 1).rgb;
  if (uLightMode == LIGHT_MAGNETOGRAM) {
    /* Tesla along the line of sight: the radial field (the regions' poles, the network and the
       global dipole in it) projected, displayed saturating softly as HMI's are. */
    float field = f.radial * mu;
    float g = tanh(field / MAGNETOGRAM_SATURATION_T);
    return g < 0.0
      ? mix(vec3(MAGNETOGRAM_GREY), uNegative, -g)
      : mix(vec3(MAGNETOGRAM_GREY), uPositive, g);
  }
  if (uLightMode == LIGHT_WHITE) {
    /* The disc as the eye adapted to sunlight sees it: the photosphere's continuum is white by
       definition and cooler gas warmer against it; the measured continuum under the Claret law
       at every zoom; relative light raised to the display contrast, then exposed below white
       at the centre. The photograph (8-bit browse discs from days apart) holds no granulation,
       only what it resolves: spots, faculae, the network, the limb. Granules are laid over it
       wherever they resolve, as on the procedural disc, the same with the map or without;
       the network's mottle is not, the photograph has its own. */
    vec3 procedural = glowAt(f.kelvin, uFaceLogY) / uSunlight;
    vec3 granulation = glowAt(f.granuleKelvin, uFaceLogY) / uSunlight;
    vec3 measured = vec3(f.measured) * granulation;
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
  /* A filament's cool sheet absorbs what lies behind it: dark in the chromosphere's light, and in
     the transition region's and the corona's, as the EUV shows filament channels. A flare's
     ribbons brighten the chromosphere too: Hα's two-ribbon flare. */
  float filamentShade = 1.0 - FILAMENT_DEPTH * f.filament;
  float chromosphere = layerResponse(log(CHROMOSPHERE_K), LAYER_CHROMOSPHERE)
    * ((BAND_QUIET * (0.55 + f.network) + BAND_NETWORK * f.network * f.network + plage)
      * (0.7 + 0.3 * (1.0 - mu)) * (1.0 - 0.6 * f.spot) * filamentShade + BAND_RIBBON * f.ribbon);
  float transition = layerResponse(log(TRANSITION_K), LAYER_TRANSITION)
    * ((0.5 * BAND_QUIET + 0.5 * BAND_NETWORK * f.network + plage) * filamentShade + BAND_RIBBON * f.ribbon);
  float open = openness(s, uDipole);
  float quietTexture = 0.35 + 2.4 * f.network * f.network;
  float quiet = (layerResponse(log(CORONA_K), LAYER_CORONA) * BAND_QUIET * quietTexture * (1.0 - HOLE_DEPTH * open)
    + layerResponse(log(HOLE_K), LAYER_CORONA) * BAND_QUIET * HOLE_FLOOR * open) * filamentShade;
  float loops = layerResponse(log(ACTIVE_K), LAYER_CORONA) * (2.0 * plage * (0.35 + 1.8 * f.network) + 0.5 * BAND_RIBBON * f.ribbon);
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

// The convection zone's cells at radius `r` (`q` in the shell's own turning frame), `octave` deep
// in cell sizes: each octave a fixed field in the body, its cells the octave's angular size at
// its own radius and PLUME_STRETCH deeper than wide, cross-faded by depth so the cells widen
// downward without shearing; an octave below two pixels fades out. About −1 in a cool downflow
// to 1 in a hot upflow's heart.
float deepCells(vec3 q, float r, float octave, float px) {
  vec3 dir = q / r;
  float value = 0.0;
  for (int k = 0; k < CONVECTION_OCTAVE_COUNT; k++) {
    float weight = 1.0 - abs(octave - float(k));
    if (weight <= 0.0) continue;
    vec4 o = uCellOctave[k];
    vec3 c = dir * (o.y + (r - o.y) / PLUME_STRETCH) * o.x + float(k) * 17.3;
    value += weight * resolvedFeature(o.x, px, 1.0) * giantCells(c, o.z);
  }
  return value;
}

// The diffusive interior's still grain: a few octaves of noise at a fixed scale, each fading
// out below two pixels; about −1 to 1.
float interiorGrain(vec3 q, float px) {
  float grain = 0.0;
  float cells = INTERIOR_GRAIN_CELLS;
  float amplitude = 1.0;
  for (int o = 0; o < 3; o++) {
    grain += amplitude * resolvedFeature(cells, px, 1.0) * gradientNoise3(q * cells + float(o) * 7.1);
    cells *= 2.3;
    amplitude *= 0.6;
  }
  return grain;
}

// A cut face at `p`: Model S's temperature there as a diagram's heat, the light made there,
// and the shell's texture, turning at its own rate; shaded by depth; gold rims on the bounds.
vec3 faceColour(vec3 p, float px, int face) {
  float r = length(p);
  vec3 dir = p / max(r, 1e-5);
  vec4 profile = tableAt(uInterior, r / uLayers.z, INTERIOR_SAMPLES, 0, 1);
  float lnT = profile.x;
  /* Rigid below the tachocline, the surface's law by latitude through the convection zone,
     the change across the tachocline's thickness: there the shells slide past each other. */
  float tachoclineBase = uLayers.y - TACHOCLINE_THICKNESS;
  float across = clamp((r - tachoclineBase) / TACHOCLINE_THICKNESS, 0.0, 1.0);
  float rate = mix(INTERIOR_TURN_RATIO, surfaceTurnRatio(dir.y), smoothstep(0.0, 1.0, across));
  vec3 q = turned(p, uTurn * (1.0 - rate));
  float pattern = 0.0;
  if (r < uLayers.y) {
    /* The diffusive interior's grain, giving way to the tachocline's laminae: thin layers
       along the shell, each streaked and carried at its own rate. */
    float laminae = gradientNoise3(q / r * TACHOCLINE_STREAKS + vec3(0.0, across * TACHOCLINE_LAMINAE, 0.0));
    float band = smoothstep(0.0, 0.25, across);
    pattern = mix(INTERIOR_GRAIN * interiorGrain(q, px), TACHOCLINE_CONTRAST * laminae, band);
  } else {
    /* Hot broad upflows and cool downflow lanes, a mixing length across at every depth. */
    pattern = CONVECTION_CONTRAST * deepCells(q, r, min(profile.z, float(CONVECTION_OCTAVE_COUNT - 1)), px);
    /* Granules at the top, where they are resolved. */
    float top = 1.0 - smoothstep(0.0, PLUME_GRANULE_DEPTH, uLayers.z - r);
    float fine = uFine * top * resolvedFeature(GRANULES_PER_RADIUS, px, 1.0);
    if (fine > 0.0) pattern += 3.0 * GRANULE_CONTRAST * fine * granuleField(q * GRANULES_PER_RADIUS, uClock.x, 1.0).x;
  }
  float heat = lnT - FACE_TOP_LN_T;
  float displayK = FACE_TOP_DISPLAY_K * exp(FACE_K_SLOPE * heat);
  float light = FACE_TOP_LIGHT * exp(FACE_LIGHT_SLOPE * heat) * (1.0 + CORE_GLOW * profile.w);
  float shimmer = 1.0 + pattern;
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
    /* The continuum's own Planck colour (Y = 1): smooth in temperature, with no fitted kinks. */
    col = spectrumAt(displayK).rgb * bright;
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
  /* The hit's change over a pixel, taken before the faces part so every pixel of a quad has it. */
  vec3 dpdx = dFdx(p);
  vec3 dpdy = dFdy(p);
  vec3 col;
  if (face == 0) {
    float mu = clamp(dot(p, -d), 0.0, 1.0);
    /* The occulted disc is black: none of the face is worked out under it. */
    col = uLightMode == LIGHT_ECLIPSE
      ? vec3(0.0)
      : surfaceColour(faceAt(p, dpdx, dpdy, mu, px), p, mu);
    if (uGrid > 0.0) col = mix(col, uGold, GRID_ALPHA * uGrid * gridLine(p, mu, px));
  } else {
    col = uLightMode == LIGHT_ECLIPSE ? vec3(0.0) : faceColour(p, px, face);
  }
  vec4 clip = uViewProjection * vec4(turned(p, uTurn), 1.0);
  gl_FragDepth = clip.z / clip.w * 0.5 + 0.5;
  gl_FragColor = vec4(displayEncode(uGamut * col), 1.0);
}
