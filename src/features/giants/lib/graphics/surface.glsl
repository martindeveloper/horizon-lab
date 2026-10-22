// The stars' faces: each point's temperature (convection, spots and faculae, pulsation, a
// pulsar's caps, a brown dwarf's clouds). A spectral lookup supplies continuum radiance;
// tabulated atmosphere profiles supply limb darkening, with a grey fallback for remnants.

#include "./granulation.glsl"

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
vec3 spot(vec2 o, float radius, float seed, float detail, float footprint) {
  float d = length(o) / max(radius, 1e-4);
  if (d > 1.5) return vec3(0.0);
  vec2 dir = o / max(length(o), 1e-5);
  float umbra = 1.0 - smoothstep(0.34, 0.42, d * (1.0 + 0.14 * gradientNoise2(dir * 2.2 + seed)));
  float penumbra = 1.0 - smoothstep(0.9, 0.98, d * (1.0 + 0.22 * gradientNoise2(dir * 1.6 + seed + 3.1)));
  float thread = 1.0 - abs(gradientNoise2(dir * 6.5 + vec2(seed, d * 0.6)));
  // Branching radial filaments, filtered at their projected width. They exist in the spot,
  // not in screen coordinates, and are never evaluated on an unfocused neighbour.
  float resolved = min(detail, 1.0) * smoothstep(2.0, 4.0, footprint / 28.0);
  if (resolved > 0.0) {
    vec2 bent = dir * 24.0 + vec2(seed + 0.8 * sin(d * 9.0 + seed), d * 1.8);
    float fine = 1.0 - abs(gradientNoise2(bent));
    thread = mix(thread, 0.4 * thread + 0.6 * fine * fine, resolved);
    if (detail > 1.0) thread += 0.12 * (detail - 1.0) * resolved * gradientNoise2(bent * 1.9 + d);
  }
  return vec3(umbra, penumbra, thread * thread);
}

// An active region `k` of the star in focus at a point of its surface: a bipolar spot group
// (a round leader, a broken follower and pores), bright faculae round it that show best
// towards the limb, flare ribbons along its neutral line, or a supergiant's dust veil.
void markRegion(inout Marks marks, vec3 s, float mu, int k, float seed, float presence, float detail, float radiusPx) {
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
  float footprint = size * radiusPx * uPixelRatio * max(mu, 0.02);
  vec3 lead = spot(l - vec2(0.42, 0.0), 0.3 * grown, rs, detail, footprint * 0.3 * grown);
  vec3 follow = spot(l - vec2(-0.46, 0.07), 0.19 * grown, rs + 7.3, detail, footprint * 0.19 * grown);
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
    marks.glow += spectrumAt(FLARE_K).rgb * RIBBON * flare * (ribbons + 1.2 * kernel);
  }
}

// A star's light at a point of its globe: `s` in its own frame, `mu` the cosine towards us,
// `faceBand` the log visible radiance of its exposure reference (`glowAt`).
vec3 starSurface(vec3 s, float mu, int style, vec4 body, vec4 surface, vec4 globe, float radiusPx, bool weather, float faceBand, int disc, float detail) {
  float seed = body.w;
  float kelvin = body.y == body.z ? body.y : profileAt(disc, abs(s.y)).a;
  float dT = 0.0;
  Marks marks = Marks(0.0, 0.0, 0.0, vec3(0.0));
  if (weather) {
    for (int k = 0; k < REGIONS; k++) markRegion(marks, s, mu, k, seed, uWeather.y, detail, radiusPx);
  }

  if (style == STYLE_CONVECTIVE) {
    float across = max(surface.x, 1.0);
    /* 1 for a red supergiant, whose giant cells bulge its limb. */
    float giant = surface.w / LIMB_ROUGHNESS;
    float contrast = mix(CELL_CONTRAST_FINE, CELL_CONTRAST_GIANT, 1.0 - smoothstep(10.0, 300.0, across));
    /* Granulation shows less towards the limb, and not in a spot. */
    float quiet = mix(0.35, 1.0, mu) * (1.0 - marks.spot);
    vec3 p = s * across + seed * 17.0;
    float fine = min(detail, 1.0) * resolvedFeature(across, radiusPx, mu);
    if (fine > 0.0 && giant < 0.5) {
      /* Dwarfs and ordinary cool giants retain granular upflows and downflows. Blended
         interiors and flowing lanes replace rigid polygon outlines on resolved surfaces. */
      float interiorDetail = min(detail, 1.0) * resolvedFeature(across * 2.7, radiusPx, mu);
      vec3 cells = granuleField(p, uTime, interiorDetail);
      float lane = cells.y;
      dT += contrast * fine * quiet * cells.x;
      // Sparse magnetic bright points in intergranular lanes; never on a hot/radiative star.
      if (weather && giant < 0.5 && detail > 1.0) {
        float tiny = resolvedFeature(across * 5.0, radiusPx, mu);
        float points = smoothstep(0.78, 0.94, cells.z) * lane * lane;
        dT += 0.055 * (detail - 1.0) * tiny * points * quiet;
      }
    }
    if (giant > 0.0) {
      /* The giant cells beneath: few, broad and slow. */
      float field = giantField(s, seed);
      dT += GIANT_CONTRAST * giant * mix(0.7, 1.0, mu) * field;
      if (detail > 0.0) {
        // Continuous, irregular intermediate structure and restrained fine turbulence.
        // Both are attached to the rotating globe and fade at their projected resolution.
        vec3 flow = 0.55 * sin(s.yzx * 3.7 + seed * 9.0 + uTime * 0.012);
        float medium = gradientNoise3(s * 6.5 + flow + seed * 13.0 + vec3(0.0, uTime * 0.018, 0.0));
        dT += 0.025 * min(detail, 1.0) * resolvedFeature(6.5, radiusPx, mu) * medium;
        if (fine > 0.0)
          dT += GIANT_FINE_CONTRAST * fine * quiet
            * gradientNoise3(p + flow * 2.0 + vec3(uTime * 0.025, 0.0, 0.0));
      }
      // Small optical-surface relief changes the emission angle, not external illumination.
      if (detail > 1.0) {
        vec3 east = normalize(cross(s, vec3(0.0, 1.0, 0.01)));
        vec3 north = cross(east, s);
        float dx = (giantField(normalize(s + 0.015 * east), seed) - field) / 0.015;
        float dy = (giantField(normalize(s + 0.015 * north), seed) - field) / 0.015;
        vec3 normal = normalize(s - surface.w * (dx * east + dy * north));
        mu = mix(mu, clamp(toView(normal, globe.x, globe.y).z, 0.0, 1.0), detail - 1.0);
      }
    }
    /* Where a dwarf's granules are too small to see, its supergranules' faint mottle shows instead. */
    float network = across / NETWORK_GRANULES;
    float shows = (1.0 - giant) * resolvedFeature(network, radiusPx, mu)
      * smoothstep(100.0, 300.0, across) * (1.0 - fine);
    if (shows > 0.0) dT += NETWORK_CONTRAST * shows * gradientNoise3(s * network + seed * 3.0 + vec3(0.0, 0.0, uTime * 0.01));
  } else if (style == STYLE_RADIATIVE || style == STYLE_WHITE_DWARF) {
    dT += RADIATIVE_MOTTLE * gradientNoise3(s * 3.0 + seed * 9.0 + vec3(0.0, uTime * 0.012, 0.0));
    if (globe.w > 0.0 && detail > 0.0) dT += min(detail, 1.0) * globe.w * pulsation(s, uTime, seed);
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
    float clouds = gradientNoise3(s * stretch + seed * 7.0);
    if (detail > 0.0) {
      float ca = gradientFbm3(turned(s, jet * a) * stretch + seed * 7.0);
      float cb = gradientFbm3(turned(s, jet * b) * stretch + seed * 7.0 + 31.0);
      clouds = mix(clouds, mix(cb, ca, wa), min(detail, 1.0));
    }
    /* Set in light, not temperature: at this warmth Planck's law makes a small swing in
       temperature a large one in light (dI/I ≈ (hc/λkT) dT/T). */
    dT += (0.2 * sin(s.y * 15.0 + 2.6 * clouds) + 0.3 * clouds) * kelvin / PLANCK_KELVIN;
  }

  kelvin *= max(1.0 + dT + marks.dT, 0.2);
  vec3 light = glowAt(kelvin, faceBand) * profileAt(disc, mu).rgb;
  /* Dust dims blue light more than red; a brown dwarf's alkali metals take its yellow and green. */
  light *= 1.0 - marks.veil * vec3(0.6, 0.78, 0.92);
  if (style == STYLE_BROWN_DWARF) light *= uAlkali;
  return light + marks.glow;
}
