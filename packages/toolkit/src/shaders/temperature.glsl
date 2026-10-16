// Approximate colour of a black body from its temperature in kelvin, using
// the common piecewise fit to the Planckian locus (Tanner Helland's curve).
// Input is clamped to 1,000–40,000 K. This is a display mapping, not a
// spectral radiance calculation.

vec3 blackbody(float kelvin) {
  float t = clamp(kelvin, 1000.0, 40000.0) / 100.0;
  vec3 c;

  // Red and green.
  if (t <= 66.0) {
    c.r = 1.0;
    c.g = clamp(0.390081578 * log(t) - 0.631841443, 0.0, 1.0);
  } else {
    float tt = max(t - 60.0, 0.01);
    c.r = clamp(1.292936186 * pow(tt, -0.1332047592), 0.0, 1.0); // 329.698727446 / 255
    c.g = clamp(1.129890861 * pow(tt, -0.0755148492), 0.0, 1.0); // 288.1221695283 / 255
  }

  // Blue.
  if (t >= 66.0) {
    c.b = 1.0;
  } else if (t <= 19.0) {
    c.b = 0.0;
  } else {
    c.b = clamp(0.543206789 * log(t - 10.0) - 1.19625389, 0.0, 1.0);
  }

  return c;
}
