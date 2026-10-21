// The stars' faces: each point's temperature (convection, spots and faculae, pulsation, a
// pulsar's caps, a brown dwarf's clouds) and the light it gives through Planck's law, seen
// through a grey atmosphere so the limb darkens and reddens.

// The light of a surface at `kelvin`: its colour, and its brightness in visible light by Planck's
// law against the face it is on, `faceBand` being 1 / that face's own band (`tints.ts`).
vec3 glowAt(float kelvin, float faceBand) {
  return blackbodyLinear(kelvin) * planckBand(kelvin, PLANCK_KELVIN) * faceBand;
}

// A point of the body's frame as the view sees it: turned back by the spin, its pole tipped
// towards us (`hitSpheroid` and `turned`, inverted).
vec3 toView(vec3 b, float turn, float tilt) {
  vec3 u = turned(b, -turn);
  float ct = cos(tilt);
  float st = -sin(tilt);
  return vec3(u.x, ct * u.y + st * u.z, -st * u.y + ct * u.z);
}

// Non-radial pulsation: modes that travel round the pole, about −1 to 1. Each is
// Re[(x + iz)^m e^(−iωt)] Q(y): a spherical harmonic Yₗᵐ without its normalisation.
float pulsation(vec3 s, float t, float seed) {
  vec2 e1 = s.xz;
  vec2 e2 = vec2(e1.x * e1.x - e1.y * e1.y, 2.0 * e1.x * e1.y);
  vec2 e3 = vec2(e2.x * e1.x - e2.y * e1.y, e2.x * e1.y + e2.y * e1.x);
  vec2 e4 = vec2(e2.x * e2.x - e2.y * e2.y, 2.0 * e2.x * e2.y);
  float y = s.y;
  float phase = 6.2831853 * seed;
  float l2m2 = dot(e2, vec2(cos(t * 0.23 + phase), sin(t * 0.23 + phase)));
  float l3m1 = dot(e1, vec2(cos(-t * 0.17 + 2.0 * phase), sin(-t * 0.17 + 2.0 * phase))) * (5.0 * y * y - 1.0) * 0.45;
  float l4m3 = dot(e3, vec2(cos(t * 0.11 + 3.0 * phase), sin(t * 0.11 + 3.0 * phase))) * y * 2.2;
  float l6m4 = dot(e4, vec2(cos(-t * 0.07 + phase), sin(-t * 0.07 + phase))) * (11.0 * y * y - 1.0) * 0.5;
  return l2m2 + l3m1 + l4m3 + l6m4;
}

// What the weather marks on a face: a share of temperature, a dust veil's depth, how much of
// the point a spot covers (its granulation is held down there), and a flare's own light.
struct Marks {
  float dT;
  float veil;
  float spot;
  vec3 glow;
};

// One spot at `o` from its centre: its umbra (1 inside), its penumbra (1 inside, umbra
// included) and the penumbra's filaments (0–1), bright and dark threads running out from the
// umbra. Both edges are ragged, the penumbra's more.
vec3 spot(vec2 o, float radius, float seed) {
  float d = length(o) / max(radius, 1e-4);
  if (d > 1.5) return vec3(0.0);
  vec2 dir = o / max(length(o), 1e-5);
  float umbra = 1.0 - smoothstep(0.34, 0.42, d * (1.0 + 0.14 * gradientNoise2(dir * 2.2 + seed)));
  float penumbra = 1.0 - smoothstep(0.9, 0.98, d * (1.0 + 0.22 * gradientNoise2(dir * 1.6 + seed + 3.1)));
  float thread = 1.0 - abs(gradientNoise2(dir * 6.5 + vec2(seed, d * 0.6)));
  return vec3(umbra, penumbra, thread * thread);
}

// An active region `k` of the star in focus at a point of its surface: a bipolar spot group
// (a round leader, a broken follower and pores), bright faculae round it that show best
// towards the limb, flare ribbons along its neutral line, or a supergiant's dust veil.
void markRegion(inout Marks marks, vec3 s, float mu, int k, float seed, float presence) {
  vec4 region = uRegion[k];
  vec4 state = uRegionState[k];
  float strength = state.x * presence;
  if (strength <= 0.0) return;
  float size = region.w;
  float reach = 2.2 * size;
  /* 1 − cos of the angle from the centre: about half its square. */
  if (1.0 - dot(s, region.xyz) > 0.5 * reach * reach) return;
  vec3 east = normalize(cross(vec3(0.0, 1.0, 0.0), region.xyz) + vec3(1e-5, 0.0, 0.0));
  vec3 north = cross(region.xyz, east);
  vec3 axis = cos(state.y) * east + sin(state.y) * north;
  vec3 side = cross(region.xyz, axis);
  vec2 l = vec2(dot(s, axis), dot(s, side)) / size;
  float rs = seed + float(k) * 3.7;

  if (state.w > 0.5) {
    /* A dust veil: a ragged cloud that dims and reddens what is behind it. */
    float cloud = 1.0 - smoothstep(0.3, 1.0, length(l) * (1.0 + 0.4 * gradientNoise2(l * 1.4 + rs)));
    marks.veil = max(marks.veil, VEIL_DEPTH * strength * cloud);
    return;
  }

  float plage = exp(-dot(l, l) / 1.5) * (0.5 + 0.5 * gradientNoise2(l * 4.5 + rs));
  marks.dT += FACULA_CONTRAST * strength * plage * (1.0 - mu);

  float grown = sqrt(strength);
  vec3 lead = spot(l - vec2(0.42, 0.0), 0.3 * grown, rs);
  vec3 follow = spot(l - vec2(-0.46, 0.07), 0.19 * grown, rs + 7.3);
  vec2 porous = l - vec2(-0.25, -0.05);
  float pores = smoothstep(0.5, 0.72, gradientNoise2(l * 7.5 + rs * 1.9)) * exp(-dot(porous, porous) / 0.14) * grown;
  float umbra = max(lead.x, follow.x);
  float penumbra = max(lead.y, follow.y);
  float filaments = lead.y > follow.y ? lead.z : follow.z;
  marks.dT -= UMBRA_DEPTH * umbra
    + PENUMBRA_DEPTH * (penumbra - umbra) * (1.5 - 1.2 * filaments)
    + 0.7 * UMBRA_DEPTH * pores * (1.0 - penumbra);
  marks.spot = max(marks.spot, max(penumbra, pores));

  float flare = state.z * presence;
  if (flare > 0.0) {
    /* Two ribbons either side of the neutral line, knotted, and the kernel between them. */
    float bend = 0.08 * sin(l.y * 3.0 + rs * 4.0);
    float a = (l.x - 0.13 - bend) / 0.05;
    float b = (l.x + 0.13 - bend) / 0.05;
    float extent = 1.0 - smoothstep(0.25, 0.8, abs(l.y));
    float knots = max(0.0, 0.45 + 0.75 * gradientNoise2(vec2(l.y * 9.0, rs + uTime * 0.7)));
    float ribbons = (exp(-a * a) + exp(-b * b)) * extent * knots;
    float kernel = exp(-dot(l, l) / 0.03);
    marks.glow += blackbodyLinear(FLARE_K) * RIBBON * flare * (ribbons + 1.2 * kernel);
  }
}

// A star's light at a point of its globe: `s` in its own frame, `mu` the cosine towards us,
// `faceBand` 1 / its face's band (`glowAt`).
vec3 starSurface(vec3 s, float mu, int style, vec4 body, vec4 surface, vec4 globe, float radiusPx, bool weather, float faceBand) {
  float seed = body.w;
  float kelvin = mix(body.y, body.z, s.y * s.y);
  float dT = 0.0;
  Marks marks = Marks(0.0, 0.0, 0.0, vec3(0.0));
  if (weather) {
    for (int k = 0; k < REGIONS; k++) markRegion(marks, s, mu, k, seed, uWeather.y);
  }

  if (style == STYLE_CONVECTIVE) {
    float across = max(surface.x, 1.0);
    /* 1 for a red supergiant, whose giant cells bulge its limb. */
    float giant = surface.w / LIMB_ROUGHNESS;
    float contrast = mix(CELL_CONTRAST_FINE, CELL_CONTRAST_GIANT, 1.0 - smoothstep(10.0, 300.0, across));
    /* Granulation shows less towards the limb, and not in a spot. */
    float quiet = mix(0.35, 1.0, mu) * (1.0 - marks.spot);
    vec3 p = s * across + seed * 17.0;
    float fine = smoothstep(GRANULE_MIN_PX, 2.0 * GRANULE_MIN_PX, radiusPx / across);
    if (fine > 0.0) {
      /* Warped, so cells are not straight-edged polygons. A giant's own granules are a soft
         turbulence over its giant cells. */
      float cell = giant > 0.5
        ? gradientFbm3(p * 0.7 + uTime * 0.03) * 1.8
        : granulation(p + 0.3 * sin(p.yzx * 0.83 + vec3(1.7, 4.1, 2.3)), uTime);
      dT += contrast * fine * quiet * cell * mix(1.0, 0.4, giant);
    }
    if (giant > 0.0) {
      /* The giant cells beneath: few, broad and slow. */
      vec3 deep = s * DEEP_CELLS + seed * 5.0;
      deep += 0.45 * sin(deep.yzx * 1.3 + 2.0 + uTime * 0.01);
      dT += contrast * giant * mix(0.5, 1.0, mu) * giantCells(deep, uTime * 0.12);
    }
    /* Where a dwarf's granules are too small to see, its supergranules' faint mottle shows instead. */
    float network = across / NETWORK_GRANULES;
    float shows = smoothstep(GRANULE_MIN_PX, 3.0 * GRANULE_MIN_PX, radiusPx / network)
      * smoothstep(100.0, 300.0, across) * (1.0 - fine);
    if (shows > 0.0) dT += NETWORK_CONTRAST * shows * gradientFbm3(s * network + seed * 3.0 + vec3(0.0, 0.0, uTime * 0.01));
  } else if (style == STYLE_RADIATIVE || style == STYLE_WHITE_DWARF) {
    dT += RADIATIVE_MOTTLE * gradientNoise3(s * 3.0 + seed * 9.0 + vec3(0.0, uTime * 0.012, 0.0));
    if (globe.w > 0.0) dT += globe.w * pulsation(s, uTime, seed);
  } else if (style == STYLE_PULSAR) {
    /* Generic antipodal dipole caps, not PSR J0030+0451's inferred hot-spot map. */
    float cap = abs(dot(s, vec3(sin(PULSAR_TILT), cos(PULSAR_TILT), 0.0)));
    dT += 0.9 * smoothstep(0.86, 0.97, cap) + 0.25 * smoothstep(0.6, 0.97, cap);
  } else if (style == STYLE_BROWN_DWARF) {
    /* Zonal jets drift each latitude at its own pace. Two phases of the flow, crossfaded, keep
       the clouds from smearing out: each restarts while the other shows. */
    float jet = 0.7 * sin(s.y * 7.0 + seed * 5.0);
    float a = fract(uTime / 24.0);
    float b = fract(uTime / 24.0 + 0.5);
    float wa = 1.0 - abs(2.0 * a - 1.0);
    vec3 stretch = vec3(2.6, 9.0, 2.6);
    float ca = gradientFbm3(turned(s, jet * a) * stretch + seed * 7.0);
    float cb = gradientFbm3(turned(s, jet * b) * stretch + seed * 7.0 + 31.0);
    float clouds = mix(cb, ca, wa);
    /* Set in light, not temperature: at this warmth Planck's law makes a small swing in
       temperature a large one in light (dI/I ≈ (hc/λkT) dT/T). */
    dT += (0.2 * sin(s.y * 15.0 + 2.6 * clouds) + 0.3 * clouds) * kelvin / PLANCK_KELVIN;
  }

  kelvin *= max(1.0 + dT + marks.dT, 0.2);
  vec3 light = glowAt(greyAtmosphereKelvin(kelvin, mu), faceBand);
  /* Dust dims blue light more than red; a brown dwarf's alkali metals take its yellow and green. */
  light *= 1.0 - marks.veil * vec3(0.6, 0.78, 0.92);
  if (style == STYLE_BROWN_DWARF) light *= uAlkali;
  return light + marks.glow;
}
