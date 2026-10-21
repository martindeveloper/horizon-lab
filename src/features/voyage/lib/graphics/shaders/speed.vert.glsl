// A mote of dust about the ship and its streak, as a ribbon facing the camera: each mote sits
// in a unit cell wrapped round the ship (`offset` is the ship's place in the lattice), so the
// dust stays put while the ship moves through it. The head is where the mote is; the tail
// where it was a moment ago, back along the ship's motion. The ribbon is extruded in screen
// space, a few pixels wide at the head (wider the nearer the mote) and tapering to nothing,
// its length on the screen capped so a mote beside the eye never smears across the view.
// Motes thin out towards the cell's edge and right at the eye; each has a size and a
// brightness of its own. At warp, with the lattice light-years wide, what streams past is
// the stars themselves: each mote then takes a blackbody colour of its own, most the dim red
// of the dwarfs that outnumber all the rest, a few bright and blue. At speed each takes the
// Doppler shift of light from its direction: bluer ahead, warmer behind.

attribute vec2 corner;  // x: 0 at the head, 1 at the tail; y: −1 or 1, the ribbon's two sides
uniform float cell;     // the lattice's spacing, km
uniform vec3 offset;    // the ship's place in its cell, 0..1
uniform vec3 streak;    // the ship's motion over the exposure, cells
uniform float alpha;
uniform vec3 dust;      // the motes' colour at rest: gold-white, cooler as the regime climbs
uniform float stars;    // 0…1: how far the motes have become stars (warp)
uniform sampler2D bbLut; // blackbody colours, log-spaced in temperature (`blackbodyLut`)
uniform vec3 bbLutSpec; // its lowest and highest temperature, kelvin, and its width in texels
uniform vec2 viewport;  // CSS px
uniform float widthPx;  // the ribbon's width at the head for a mote a cell away
uniform float longestPx; // the longest streak on the screen
uniform vec3 forward;   // the ship's direction of travel, unit
uniform float beta;
uniform float gamma;

varying float vAlong;
varying float vSide;
varying float vAlpha;
varying vec3 vTint;

#include <horizon/relativity>
#include <horizon/seeded-hash>
#include <horizon/log-depth>
#include <horizon/temperature>

const vec3 BLUE = vec3(0.7, 0.82, 1.0);
const vec3 WARM = vec3(1.0, 0.55, 0.32);

void main() {
  vAlong = corner.x;
  vSide = corner.y;
  vec3 p = fract(position - offset) - 0.5;
  float r = length(p) * 2.0;
  float edge = 1.0 - smoothstep(0.55, 1.0, r);
  float eye = smoothstep(0.04, 0.16, r);
  /* Each mote its own: most small and faint, a few large and bright. */
  float own = seededHash3(position, 1.0);
  float size = mix(0.6, 1.7, own * own);
  float bright = mix(0.3, 1.0, own * own * own);
  /* A star's temperature: a second hash, cubed, so most are cool and dim and few are hot. */
  float heat = seededHash3(position, 7.0);
  heat *= heat * heat;
  float u = blackbodyLutTexel(2600.0 * pow(30000.0 / 2600.0, heat), bbLutSpec);
  vec3 starColour = texture2D(bbLut, vec2(u, 0.5)).rgb;
  bright *= mix(1.0, mix(0.35, 1.6, heat), stars);
  size *= mix(1.0, mix(0.7, 1.4, heat), stars);
  vAlpha = alpha * edge * eye * bright;
  vTint = mix(dust, starColour, stars);
  if (beta > 0.0) {
    float D = dopplerFactor(beta, gamma, dot(normalize(p), forward));
    float shift = clamp(log2(D) / 3.0, -1.0, 1.0);
    vTint = shift > 0.0 ? mix(vTint, BLUE, shift) : mix(vTint, WARM, -shift);
  }
  mat4 vp = projectionMatrix * viewMatrix;
  vec4 head = vp * vec4(p * cell, 1.0);
  vec4 tail = vp * vec4((p + streak) * cell, 1.0);
  /* Behind the eye, or across it: nothing to draw. */
  if (head.w <= 0.0 || tail.w <= 0.0) {
    vAlpha = 0.0;
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }
  vec2 mid = viewport * 0.5;
  vec2 hs = head.xy / head.w * mid;
  vec2 ts = tail.xy / tail.w * mid;
  vec2 along = ts - hs;
  float len = length(along);
  /* The screen cap: a long smear shortens towards the head, and fades a little as it does. */
  if (len > longestPx) {
    float k = longestPx / len;
    tail = mix(head, tail, k);
    ts = hs + along * k;
    along = ts - hs;
    vAlpha *= mix(1.0, 0.6, min(1.0, (len - longestPx) / longestPx));
    len = longestPx;
  }
  /* The ribbon: wider at the head and for a nearer mote, never under a pixel nor over a few. */
  float w = clamp(widthPx * size * cell / head.w, 0.8, 3.6) * mix(1.0, 0.15, sqrt(corner.x));
  vec2 dir = len > 0.5 ? along / len : vec2(1.0, 0.0);
  vec2 n = vec2(-dir.y, dir.x);
  vec4 at = mix(head, tail, corner.x);
  at.xy += n * corner.y * w / mid * at.w;
  gl_Position = at;
  logDepthVertex();
}
