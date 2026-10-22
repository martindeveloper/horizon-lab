// A ribbon's light: a soft core inside a faint halo, coloured by polarity (gold out, blue in)
// in true colour and the magnetogram, by its plasma's temperature through the band otherwise;
// shown as much as the light shows the field; open lines fade past the source surface. Added
// to what is behind, depth-tested against the globe.
precision highp float;

#include "./sun-common.glsl"
#include <horizon/srgb>
#include <horizon/gradient-noise>

uniform vec3 uPositive;
uniform vec3 uNegative;
uniform vec3 uMagPositive;
uniform vec3 uMagNegative;
uniform float uPresence;   // how much the field shows in this light
varying float vAcross;
varying vec4 vLine;
varying float vRadius;
varying float vFade;
varying float vAlong;
varying vec3 vWorld;
varying float vTaper;
varying float vTube;
varying float vSeed;

void main() {
  /* Across the halo: the core's share of its width, a Gaussian; the halo a soft fall-off. */
  float coreShare = RIBBON_WIDTH_PX / RIBBON_HALO_PX;
  float bend = 0.055 * sin(vAlong * 19.0 + vSeed);
  float x = abs(vAcross - bend) / coreShare;
  float core = exp(-x * x * 2.0);
  float halo = (1.0 - abs(vAcross)) * (1.0 - abs(vAcross));
  float profile = RIBBON_CORE * core + RIBBON_HALO * halo;
  if (uLightMode == LIGHT_BAND) {
    // Uneven bundles of emissive threads, with flow along each arc and a
    // separate phase for its neighbours. The magnetogram stays diagrammatic.
    // Eruption motion is supplied by the flux model and its passive tracers. Keep its
    // texture static when scrubbing/paused instead of adding unrelated clock-driven flow.
    float flowClock = vTube > 1.0 ? 0.0 : uClock.x * 0.55;
    float flow = gradientNoise2(vec2(vAlong * 22.0 - flowClock, vSeed));
    float clumps = gradientNoise2(vec2(vAlong * 6.0, vSeed + 7.1));
    float density = 0.55 + 0.35 * clumps + 0.25 * flow;
    float threadA = exp(-pow((vAcross - bend - 0.28) / 0.12, 2.0));
    float threadB = exp(-pow((vAcross - bend + 0.24) / 0.085, 2.0));
    float threads = (threadA + 0.65 * threadB) * smoothstep(0.02, 0.15, vAlong) * (1.0 - smoothstep(0.85, 0.98, vAlong));
    profile = (0.65 * profile + 0.22 * threads) * density * density;
  }
  // A trace leaving the local model volume continues beyond it; fade its extent rather
  // than presenting the edge of that volume as a free end of the magnetic field.
  float open = vLine.y > 0.5 ? (1.0 - smoothstep(OPEN_FADE_FROM, OPEN_FADE_TO, vRadius)) * (1.0 - smoothstep(0.8, 1.0, vAlong)) * vTaper : 1.0;
  float a = profile * open * vFade * vLine.z * uPresence;
  /* An arcade's tubes glow; the magnetogram's lines are a soft overlay. */
  if (vTube > 1.0) a *= TUBE_GLOW;
  if (uLightMode == LIGHT_MAGNETOGRAM) a *= MAGNETOGRAM_LINE;
  if (a <= 0.002) discard;
  /* An eclipse's occulting disc hides whatever lies in front of the face too. */
  if (uLightMode == LIGHT_ECLIPSE && length(cross(normalize(vWorld - cameraPosition), cameraPosition)) < 1.0) discard;
  /* A line's plasma, through the band: coronal plasma by the corona's weight, flare plasma by
     the flare's; a cool line (a rope, a filament) by the chromosphere's, with the hot sheath
     round it, which glows the rope's brightest. */
  float lnK = log(max(vLine.w, 1.0));
  float flareShare = smoothstep(log(ACTIVE_K), log(FLARE_K), lnK);
  float cool = 1.0 - smoothstep(log(CHROMOSPHERE_K), log(TRANSITION_K), lnK);
  float hot = mix(uWeights.w * layerResponse(lnK, LAYER_CORONA), uFlareWeight * layerResponse(lnK, LAYER_FLARE), flareShare);
  float sheath = LINE_SHEATH * (uWeights.z * layerResponse(log(TRANSITION_K), LAYER_TRANSITION) + 0.5 * uWeights.w * layerResponse(log(CORONA_K), LAYER_CORONA));
  float lit = mix(hot, uWeights.y * layerResponse(lnK, LAYER_CHROMOSPHERE) + sheath, cool) * (1.0 + (ROPE_GLOW - 1.0) * cool * step(1.5, vTube));
  // Field lines are an optional connectivity overlay. Keep eruption contours faintly
  // readable even when their hot plasma emits outside the selected thermal passband.
  float contour = vTube > 1.0 ? 0.18 * a : 0.0;
  vec3 col = uLightMode == LIGHT_BAND
    ? rampAt(uBandScale * lit * a * RIBBON_BAND_GAIN + contour)
    : (uLightMode == LIGHT_MAGNETOGRAM ? (vLine.x > 0.0 ? uMagPositive : uMagNegative) : (vLine.x > 0.0 ? uPositive : uNegative)) * a;
  gl_FragColor = vec4(encodeSrgb(uGamut * col), 1.0);
}
