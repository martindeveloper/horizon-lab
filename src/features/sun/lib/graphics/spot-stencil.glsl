// Appearance stencil extracted offline from the same HMI image as the distant globe.
// Linear byte data, no colour conversion or mipmaps across unrelated atlas tiles.
uniform sampler2D uSpotAtlas;
uniform sampler2D uSpotPages;
uniform float uStencilShown;

// Penumbral coverage, umbral coverage, detailed relative continuum, transition support.
vec4 photographedSpot(vec2 uv, vec3 body, float px, float mu) {
  vec2 sourceSize = vec2(STENCIL_WIDTH, STENCIL_HEIGHT);
  vec2 source = vec2(fract(uv.x), clamp(1.0 - uv.y, 0.0, 0.999999)) * sourceSize;
  vec2 page = floor(source / STENCIL_TILE);
  vec2 pagesUv = (page + 0.5) / (sourceSize / STENCIL_TILE);
  vec2 address = floor(texture2D(uSpotPages, vec2(pagesUv.x, 1.0 - pagesUv.y)).rg * 255.0 + 0.5);
  if (address.x < 0.5) return vec4(0.0, 0.0, 1.0, 0.0);
  vec2 atlasSize = vec2(STENCIL_ATLAS_WIDTH, STENCIL_ATLAS_HEIGHT);
  vec2 at = ((address - 1.0) * (STENCIL_TILE + 2.0 * STENCIL_GUTTER)
    + STENCIL_GUTTER + source - page * STENCIL_TILE) / atlasSize;
  at.y = 1.0 - at.y;
  vec3 data = texture2D(uSpotAtlas, at).rgb;
  vec2 distance = (data.gb - 0.5) * 2.0 * vec2(STENCIL_PENUMBRA_RANGE, STENCIL_UMBRA_RANGE);
  float support = 1.0 - smoothstep(0.0, STENCIL_PENUMBRA_RANGE - 1.0, distance.x);
  if (support <= 0.0) return vec4(0.0, 0.0, 1.0, 0.0);
  float pixel = px * STENCIL_WIDTH / (TWO_PI * max(mu, 0.02));
  float aa = max(0.65, pixel);
  float penumbra = 1.0 - smoothstep(-aa, aa, distance.x);
  float umbra = 1.0 - smoothstep(-aa, aa, distance.y);
  float penOnly = penumbra * (1.0 - umbra);
  float light = data.r / SUN_MAP_QUIET_INTENSITY;
  float umbraReference = exp(spectrumAt(UMBRA_K).a - uFaceLogY);
  // The browse palette clips some cores to black. A modest modelled continuum
  // floor lets their fine structure remain visible; it is not inferred thermometry.
  light = mix(light, max(light, 0.8 * umbraReference), umbra);

  // Use the contour gradient to orient short elongated filaments away from each
  // photographed umbra, including complex groups. Never redraw a circular spot.
  float fine = resolvedFeature(GRANULES_PER_RADIUS * 5.0, px, mu);
  if (penOnly > 0.0 && fine > 0.0 && abs(distance.y) < STENCIL_UMBRA_RANGE - 2.0) {
    vec2 texel = 1.0 / atlasSize;
    vec2 gradient = vec2(
      texture2D(uSpotAtlas, at + vec2(texel.x, 0.0)).b - texture2D(uSpotAtlas, at - vec2(texel.x, 0.0)).b,
      texture2D(uSpotAtlas, at - vec2(0.0, texel.y)).b - texture2D(uSpotAtlas, at + vec2(0.0, texel.y)).b
    );
    float latitudeScale = max(length(body.xz), 0.1);
    gradient.x /= latitudeScale;
    vec3 east = vec3(body.z, 0.0, -body.x) / latitudeScale;
    vec3 south = vec3(body.x * body.y / latitudeScale, -latitudeScale, body.z * body.y / latitudeScale);
    vec3 outward = normalize(east * gradient.x + south * gradient.y + vec3(1e-8));
    vec3 q = body * GRANULES_PER_RADIUS * 5.0;
    float strands = 0.0;
    for (int k = -3; k <= 3; k++) strands += gradientNoise3(q + outward * float(k) * 1.1);
    strands /= 7.0;
    float temperature = PENUMBRA_K * (1.0 + 0.35 * PENUMBRA_FILAMENT * strands * penOnly * fine);
    light *= exp(spectrumAt(temperature).a - spectrumAt(PENUMBRA_K).a);
  }
  if (umbra > 0.0) {
    // Individual, stationary births. The photographic mask controls every dot,
    // even in pores outside the simplified magnetic model's active regions.
    float radius = UMBRAL_DOTS / GRANULES_PER_RADIUS;
    // Blend body-space projections: longitude × cos(latitude) would shear small
    // dots into diagonal streaks and introduce a seam at the map's longitude zero.
    float projection = smoothstep(0.35, 0.65, body.x * body.x / max(dot(body.xz, body.xz), 1e-5));
    float dots = 0.0;
    if (projection > 0.0)
      dots += projection * umbralDots(body.zy, radius, 23.7, radius * mu / px, uClock.x);
    if (projection < 1.0)
      dots += (1.0 - projection) * umbralDots(body.xy, radius, 41.3, radius * mu / px, uClock.x);
    float bright = exp(spectrumAt(UMBRA_K * (1.0 + UMBRAL_DOT_CONTRAST * dots)).a - uFaceLogY);
    // Add the temperature excess: black display pixels in the quicklook image
    // still support faint dots; the photographed boundary and dark core stay fixed.
    light += (bright - umbraReference) * umbra;
  }
  return vec4(penumbra, umbra, light, support);
}
