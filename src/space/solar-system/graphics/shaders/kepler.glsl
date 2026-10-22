// A body on its orbit, exactly as the toolkit's keplerPosition places it: Kepler's equation
// E − e sin E = M by Newton's method from E = M + e sin M, the perifocal position, then the
// classical rotation (ω, i, Ω) into the ecliptic. Angles in radians, a in AU.
//
// Scene frame: X = ecliptic x, Y = ecliptic z (up), Z = −ecliptic y.

#ifndef HORIZON_SOLAR_KEPLER
#define HORIZON_SOLAR_KEPLER

vec3 keplerPosition(float a, float e, float inc, float node, float omega, float M, int steps) {
  float E = M + e * sin(M);
  for (int k = 0; k < steps; k++) {
    E -= (E - e * sin(E) - M) / (1.0 - e * cos(E));
  }

  float xp = a * (cos(E) - e);
  float yp = a * sqrt(1.0 - e * e) * sin(E);
  float cw = cos(omega);
  float sw = sin(omega);
  float cn = cos(node);
  float sn = sin(node);
  float ci = cos(inc);
  float si = sin(inc);
  float x = (cw * cn - sw * sn * ci) * xp + (-sw * cn - cw * sn * ci) * yp;
  float y = (cw * sn + sw * cn * ci) * xp + (-sw * sn + cw * cn * ci) * yp;
  float z = sw * si * xp + cw * si * yp;
  return vec3(x, z, -y);
}

#endif // HORIZON_SOLAR_KEPLER
