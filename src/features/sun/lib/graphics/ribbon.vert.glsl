// Field lines as ribbons of constant screen width: one instance per segment, its quad
// widened in view space to the halo's width by the pixel's size at its depth, mitred with its
// neighbours so a line's quads share edges and nothing doubles where they meet; open lines
// taper toward the source surface.
#include "./parameters.generated.glsl"

attribute vec3 aPrev;
attribute vec3 aStart;
attribute vec3 aEnd;
attribute vec3 aNext;
attribute vec4 aLine;   // polarity; open; strength (0–1); kelvin
attribute vec2 aAlong;  // progress along the line at the start and the end
attribute float aFade;  // an arcade copy's fall-off, the background's step back (1 for a line of its own)
attribute float aTube;  // the width against a field line's: 1, or an arcade's tubes
uniform float uHalfWidth;  // half the halo's width, world per unit distance (px × world per px)
varying float vAcross;
varying vec4 vLine;
varying float vRadius;
varying float vFade;
varying float vAlong;
varying vec3 vWorld;
varying float vTaper;
varying float vTube;

vec2 perpendicular(vec2 v) {
  float len = length(v);
  return len > 1e-7 ? vec2(-v.y, v.x) / len : vec2(0.0);
}

void main() {
  bool atEnd = position.x > 0.5;
  vec3 here = atEnd ? aEnd : aStart;
  vec3 before = atEnd ? aStart : aPrev;
  vec3 after = atEnd ? aNext : aEnd;
  vec4 p = modelViewMatrix * vec4(here, 1.0);
  vec4 b = modelViewMatrix * vec4(before, 1.0);
  vec4 a = modelViewMatrix * vec4(after, 1.0);
  vec2 n1 = perpendicular(p.xy - b.xy);
  vec2 n2 = perpendicular(a.xy - p.xy);
  if (dot(n1, n1) < 0.5) n1 = n2;
  if (dot(n2, n2) < 0.5) n2 = n1;
  vec2 mitre = n1 + n2;
  float len = length(mitre);
  mitre = len > 1e-5 ? mitre / len : n1;
  /* Kept to the width across a corner, within reason. */
  float scale = 1.0 / max(dot(mitre, n1), 0.5);
  float along = atEnd ? aAlong.y : aAlong.x;
  /* An open line narrows on its way out. */
  float taper = aLine.y > 0.5 ? mix(1.0, OPEN_TAPER, along) : 1.0;
  /* Weak lines draw thinner; an arcade's draw as tubes. */
  float weak = mix(RIBBON_WEAK_WIDTH, 1.0, aLine.z);
  float halfWidth = uHalfWidth * max(-p.z, 1e-4) * scale * taper * weak * aTube;
  vec2 offset = mitre * halfWidth * position.y;
  vAcross = position.y;
  vLine = aLine;
  vRadius = length(here);
  vFade = aFade;
  vAlong = along;
  vWorld = (modelMatrix * vec4(here, 1.0)).xyz;
  vTaper = taper;
  vTube = aTube;
  gl_Position = projectionMatrix * vec4(p.xy + offset, p.z, 1.0);
}
