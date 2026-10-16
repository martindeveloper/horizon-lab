// Artistic one-sided rim factor. Both directions must be normalized.
// This power curve is not a physical Fresnel reflectance approximation.
float fresnelRim(vec3 normal, vec3 viewDir, float power) {
  return pow(1.0 - clamp(dot(normal, viewDir), 0.0, 1.0), power);
}
