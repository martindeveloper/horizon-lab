// Special relativity for a sky seen from a fast ship. Mirrors science/relativity.ts:
// `beta` is v/c, `gamma` its Lorentz factor, `forward` the unit direction of travel.

// Where the rest-frame direction `n` (unit) appears to the moving observer:
// n' = (n + forward ((gamma - 1) c + gamma beta)) / (gamma (1 + beta c)), c = n . forward.
// Directions crowd towards `forward`.
vec3 aberrate(vec3 n, vec3 forward, float beta, float gamma) {
  float c = dot(n, forward);
  float along = (gamma - 1.0) * c + gamma * beta;
  return (n + forward * along) / (gamma * (1.0 + beta * c));
}

// Doppler factor nu_obs / nu_src for light from the rest-frame direction at cos(theta)
// to the velocity: D = gamma (1 + beta cos theta). Multiply a temperature by it.
float dopplerFactor(float beta, float gamma, float cosTheta) {
  return gamma * (1.0 + beta * cosTheta);
}

// The same factor from the observed (aberrated) angle: D = 1 / (gamma (1 - beta cos theta')).
float dopplerFactorObserved(float beta, float gamma, float cosThetaObserved) {
  return 1.0 / (gamma * (1.0 - beta * cosThetaObserved));
}
