// Close-range solar structure. All coordinates stay on the body, and each octave
// fades at its own projected footprint rather than shimmering as the camera moves.
#include <horizon/gradient-noise>

vec3 solarSpot(vec2 offset, float radius, float seed, float footprint) {
  vec2 shape = offset * vec2(1.0 + 0.1 * sin(seed), 1.0 - 0.1 * sin(seed));
  float r = length(shape) / max(radius, 1e-4);
  if (r > 1.5) return vec3(0.0);
  vec2 direction = normalize(shape + vec2(1e-7));
  float edge = gradientNoise2(direction * 3.1 + seed);
  float fineEdge = gradientNoise2(direction * 9.7 + seed * 2.1);
  float umbraR = r * (1.0 + 0.38 * edge + 0.09 * fineEdge);
  float penumbraR = r * (1.0 + 0.3 * edge + 0.1 * fineEdge);
  float aa = max(1.2 / max(footprint, 1.0), 0.012);
  float umbra = 1.0 - smoothstep(0.35 - aa, 0.39 + aa, umbraR);
  float penumbra = 1.0 - smoothstep(0.88 - aa, 1.02 + aa, penumbraR);
  // Filaments bend, split and end at different radii; no coherent circular wave.
  float turn = 0.055 * sin(r * 8.0 + seed) + 0.04 * fineEdge;
  vec2 bent = mat2(cos(turn), -sin(turn), sin(turn), cos(turn)) * direction;
  float coarse = gradientNoise3(vec3(bent * 28.0, r * 7.0 + seed));
  float resolved = smoothstep(1.5, 3.5, footprint / 75.0);
  float threads = gradientNoise3(vec3(bent * 75.0 + coarse, r * 13.0 + seed));
  float strand = mix(coarse, 0.35 * coarse + 0.65 * threads, resolved);
  float grains = smoothstep(0.05, 0.5, strand) * exp(-pow((r - 0.48) / 0.2, 2.0));
  // Occasional intrusions interrupt the umbra instead of every spot being a
  // featureless circular pupil. Their contrast remains below the quiet Sun.
  float bridge = exp(-pow((shape.x / max(radius, 1e-4) + 0.05 * sin(r * 9.0 + seed)) / 0.045, 2.0));
  umbra *= 1.0 - 0.38 * bridge * smoothstep(0.2, 0.6, sin(seed * 3.1));
  return vec3(umbra, penumbra, clamp(0.5 + 0.65 * strand + 0.2 * grains, 0.0, 1.0));
}

float penumbralFlow(vec2 offset, float radius, float regionRadius, float travelled, float seed) {
  // offset is already in region-radius units. Only the travelled world distance
  // needs regionRadius here; dividing offset by it again made concentric moiré.
  float r = length(offset) / max(radius, 1e-4);
  vec2 direction = normalize(offset + vec2(1e-7));
  float flow = travelled / max(radius * regionRadius, 1e-5);
  return gradientNoise3(vec3(direction * 32.0 + seed, (r - flow) * EVERSHED_WAVES));
}

// Fine mottles and fibrils laid over a warped magnetic network. The field is
// continuous in 3D, including the longitude seam and both poles.
float chromosphericNetwork(vec3 body, float cells, float px, float mu, float detail) {
  vec3 p = body * cells;
  vec3 warp = vec3(gradientNoise3(p * 0.7), gradientNoise3(p * 0.7 + 17.1), gradientNoise3(p * 0.7 - 9.2));
  float broad = gradientNoise3(p + 0.8 * warp);
  float lanes = exp(-24.0 * broad * broad);
  float result = 0.36 + 0.12 * broad + 0.07 * lanes;
  float middle = resolvedFeature(cells * 3.0, px, mu);
  if (middle > 0.0) {
    vec3 m = p * 3.0 + 1.4 * warp + vec3(uClock.y * 0.08, 0.0, 0.0);
    result += middle * (0.27 * gradientNoise3(m * vec3(1.0, 0.32, 1.0)) + 0.13 * gradientNoise3(m.yzx + 4.7));
  }
  float seen = detail * resolvedFeature(cells * FIBRIL_SCALE, px, mu);
  if (seen > 0.0) {
    vec3 flow = p * FIBRIL_SCALE + 2.2 * warp + vec3(0.0, uClock.y * 0.12, 0.0);
    float fibrils = gradientNoise3(flow * vec3(1.0, 0.22, 1.0));
    float crossed = gradientNoise3(flow.yzx * vec3(0.3, 1.0, 1.0) + 13.7);
    result += seen * (0.23 * fibrils + 0.1 * crossed);
  }
  return clamp(result, 0.06, 0.85);
}
