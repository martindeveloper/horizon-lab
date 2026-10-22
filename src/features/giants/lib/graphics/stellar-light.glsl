// `spectrumAt` and `glowAt` are the shared continuum's (src/space/sun/graphics/shaders/continuum.glsl).
vec4 profileAt(int i, float x) {
  float at = clamp(x, 0.0, 1.0) * float(PROFILE_SAMPLES - 1);
  float lo = floor(at);
  float row = (float(i) + 0.5) / float(MAX_DISCS);
  vec4 a = texture2D(uProfiles, vec2((lo + 0.5) / float(PROFILE_SAMPLES), row));
  vec4 b = texture2D(uProfiles, vec2((min(lo + 1.0, float(PROFILE_SAMPLES - 1)) + 0.5) / float(PROFILE_SAMPLES), row));
  return mix(a, b, at - lo);
}

// The narrowest projected cell dimension in actual drawing-buffer pixels. Filtering
// changes visibility, never a feature's physical size, seed, latitude or lifetime.
float resolvedFeature(float perRadius, float radiusPx, float mu) {
  float pixels = radiusPx * uPixelRatio * max(mu, 0.02) / max(perRadius, 1.0);
  return smoothstep(SURFACE_RESOLVE_PX, 2.0 * SURFACE_RESOLVE_PX, pixels);
}

// Broad, evolving supergiant cells, shared by heat, relief and the silhouette. The two
// smoothly joined generations have different lifetimes for each star. All coordinates
// are attached to its rotating globe; this is a procedural surrogate, not an RHD solution.
float giantField(vec3 s, float seed) {
  float t = uTime / (55.0 + 35.0 * seed);
  float age = fract(t);
  float epoch = floor(t);
  float blend = age * age * age * (age * (6.0 * age - 15.0) + 10.0);
  vec3 p = s * DEEP_CELLS + seed * 5.0;
  vec3 flow = 0.28 * vec3(
    sin(p.y + uTime * 0.013), sin(p.z - uTime * 0.009), sin(p.x + uTime * 0.011));
  float a = gradientNoise3(p + flow + vec3(epoch * 1.73, epoch * 0.61, seed));
  float b = gradientNoise3(p + flow + vec3((epoch + 1.0) * 1.73, (epoch + 1.0) * 0.61, seed));
  return clamp(1.65 * mix(a, b, blend), -1.0, 1.0);
}
