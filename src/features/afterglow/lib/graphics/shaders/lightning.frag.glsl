// Lightning over Earth's night side, added under the air: flashes at the globe's measured rate
// (uDensity, `model/lightning.ts`), gathered into storms. The globe is cut into cells of
// latitude and longitude; a share of them hold a storm, and each storm draws at most one flash
// a slot, by the chance its cell's share of the sky gives it, so the globe's total is the
// measured one. A flash is a few return strokes, each lighting the cloud about one point and
// dying away. Day's cloud outshines it: it shows where the Sun is below the horizon.

uniform vec3 uSun;       // direction to the Sun, globe space, unit
uniform float uTime;     // the scene's seconds
uniform float uDensity;  // flashes a second per steradian of the globe
uniform float uShown;    // 0–1, taken up and let go with the clock

varying vec3 vObject;

#include <horizon/noise>
#include "./parameters.generated.glsl"

void main() {
  vec3 d = normalize(vObject);
  float night = 1.0 - smoothstep(-LIGHTNING_DUSK, 0.0, dot(d, uSun));
  if (night <= 0.0) discard;
  vec2 cell = floor(vec2(atan(d.z, d.x), asin(clamp(d.y, -1.0, 1.0))) / LIGHTNING_CELL);
  if (hash21(cell) >= LIGHTNING_STORMS) discard;

  // Each storm keeps its own beat, so no two flash in step.
  float slot = uTime / LIGHTNING_SLOT_S + hash21(cell + 0.5);
  vec3 key = vec3(cell, floor(slot));
  float sky = LIGHTNING_CELL * LIGHTNING_CELL * cos((cell.y + 0.5) * LIGHTNING_CELL);
  if (hash13(key) >= uDensity * sky * LIGHTNING_SLOT_S / LIGHTNING_STORMS) discard;

  // Where in the cell, a glow's reach inside its edges, and how far this point is from it.
  vec2 at = (cell + 0.5 + (vec2(hash13(key + 0.31), hash13(key + 0.73)) - 0.5) * LIGHTNING_SPREAD)
    * LIGHTNING_CELL;
  vec3 from = d - vec3(cos(at.y) * cos(at.x), sin(at.y), cos(at.y) * sin(at.x));
  float glow = exp(-dot(from, from) / (LIGHTNING_REACH * LIGHTNING_REACH));

  // The strokes: the first at full strength, the rest each at its own, some barely there.
  float since = fract(slot) * LIGHTNING_SLOT_S
    - hash13(key + 0.57) * (LIGHTNING_SLOT_S - LIGHTNING_FLASH_S);
  float flash = 0.0;
  for (int k = 0; k < LIGHTNING_STROKES; k++) {
    float s = since - float(k) * LIGHTNING_STROKE_GAP_S;
    if (s < 0.0) break;
    flash += exp(-s / LIGHTNING_STROKE_FADE_S) * (k == 0 ? 1.0 : hash13(key + float(k)));
  }

  vec3 light = LIGHTNING_RGB * (LIGHTNING_PEAK * uShown * night * glow * flash);
  gl_FragColor = linearToOutputTexel(vec4(light, 1.0));
}
