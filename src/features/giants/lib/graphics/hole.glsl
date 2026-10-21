// A schematic Schwarzschild comparison. The warm rim marks r_s, not a visible horizon.
// A display ring marks the critical impact parameter at infinity, 3√3/2 r_s; the physical
// photon sphere instead has areal radius 1.5 r_s. Width, colour, beaming and flicker are
// illustrative. EHT's broad emission ring is not the narrow photon ring represented here.
// Inside it no starlight from behind gets through (`lensed`); outside, the stars bend round it.
// The ring is drawn with the sky, behind every body; the horizon with the bodies.
// Its disk, jet and lensed arcs are the black-hole lab's subject: a hole's card links there.

// A hole's horizon at `o`, horizon radii from its centre, `radiusPx` its radius on screen: the
// rim's light (premultiplied) and how much of what is behind it the horizon hides.
vec4 horizon(vec2 o, float radiusPx) {
  float rho = length(o);
  float aa = 1.0 / radiusPx;
  float off = (rho - 1.0) * radiusPx / 1.2;
  return vec4(uAccent * HOLE_RIM * exp(-off * off), 1.0 - smoothstep(1.0 - aa, 1.0 + aa, rho));
}

// A schematic photon-ring marker at `o`: a line at least a pixel wide in a softer glow of lensed
// light, mostly outside it (inside lies the dark shadow). `ring` is its glow, its light's
// temperature (K), its flicker and the angle it is brightest at. It is drawn with the sky,
// behind every body, so it passes behind its neighbours on the ladder.
vec3 photonRing(vec2 o, float radiusPx, vec4 ring, float seed) {
  float rho = length(o);
  float width = max(HOLE_RING_WIDTH * radiusPx, 1.1);
  float apart = (rho - HOLE_SHADOW) * radiusPx / width;
  float line = exp(-apart * apart);
  float beyond = rho - HOLE_SHADOW;
  float glow = exp(-abs(beyond) / (beyond > 0.0 ? HOLE_RING_GLOW : 0.25 * HOLE_RING_GLOW));
  vec2 dir = o / max(rho, 1e-5);
  float beamed = 1.0 + HOLE_RING_BEAMING * dot(dir, vec2(cos(ring.w), sin(ring.w)));
  float spots = 1.0 + ring.z * 0.35 * gradientNoise3(vec3(dir * 1.6 + seed * 7.0, uTime * 0.25));
  return blackbodyLinear(ring.y) * ring.x * beamed * spots * (line + 0.35 * glow);
}
