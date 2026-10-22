// An orbit's ellipse built in the vertex stage. The line's vertices are static samples
// (`orbitSample`: cos u, sin u of a sampling anomaly u from the body, tightening towards it:
// `orbitSamples` in scene/lines.ts); the uniforms carry
// the ellipse and its plane in the line's own frame, written in double precision on the CPU
// (`writeOrbitUniforms` in scene/lines.ts), so single precision here only rounds the result.

attribute vec2 orbitSample;
uniform vec4 orbitConic; // a, a e, b = a sqrt(1 - e^2), and the spacing k
uniform vec3 orbitP;     // perifocal axes, unit: towards periapsis,
uniform vec3 orbitQ;     // and 90 degrees on along the motion
uniform vec2 orbitStart; // cos, sin of the body's u: the line starts on the body

// The sample's point about the focus. u lies between the eccentric anomaly E and the true
// anomaly v: tan(E/2) = tan(u/2) / k and tan(v/2) = k tan(u/2), k^4 = (1 + e) / (1 - e), so
// seen from the focus the chords stray as little at periapsis as at apoapsis. Rational in
// (cos u, sin u), the sample turned on by the start: no trigonometry per vertex.
vec3 orbitPoint() {
  float k = orbitConic.w;
  vec2 u = vec2(
    orbitSample.x * orbitStart.x - orbitSample.y * orbitStart.y,
    orbitSample.y * orbitStart.x + orbitSample.x * orbitStart.y
  );
  float toward = k * k * (1.0 + u.x);
  float away = 1.0 - u.x;
  float cosE = (toward - away) / (toward + away);
  float sinE = 2.0 * k * u.y / (toward + away);
  return orbitP * (orbitConic.x * cosE - orbitConic.y) + orbitQ * (orbitConic.z * sinE);
}
